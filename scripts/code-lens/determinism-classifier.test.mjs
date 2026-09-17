/**
 * scripts/code-lens/determinism-classifier.test.mjs
 *
 * El contrato de la clasificación por archivo.
 *
 * La falla peligrosa acá no es clasificar mal un archivo raro: es que el
 * clasificador diga "puro" sobre algo que toca el entorno, porque entonces la
 * matriz de determinismo publicada promete una reproducibilidad que el sistema
 * no tiene. Por eso las pruebas atacan la precedencia —que la señal más
 * no-determinista gane— y el filtro de comentarios, que es donde un falso
 * positivo y un falso negativo se tocan.
 */

import assert from 'node:assert/strict'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  DETERMINISM_CLASSES,
  PURE_CLASS,
  auditDeterminism,
  classifySource,
  stripComments,
  summarize,
} from './determinism-classifier.mjs'

const REPO = path.resolve(import.meta.dirname, '../..')

describe('classifySource — precedencia', () => {
  it('clasifica como puro un módulo sin superficie externa', () => {
    const got = classifySource('export const sum = (a, b) => a + b\n')
    assert.equal(got.class, PURE_CLASS.id)
    assert.deepEqual(got.signals, [])
  })

  it('clasifica por filesystem cuando sólo lee archivos', () => {
    assert.equal(classifySource("import fs from 'node:fs'\n").class, 'estado-fijado')
  })

  it('el entorno GANA sobre el filesystem', () => {
    // Un módulo que lee archivos Y consulta process.env no es "determinista
    // sobre estado fijado": el entorno lo mueve sin que cambie un byte del árbol.
    const got = classifySource("import fs from 'node:fs'\nconst r = process.env.HOME\n")
    assert.equal(got.class, 'proceso-o-entorno')
  })

  it('el tiempo GANA sobre el filesystem', () => {
    const got = classifySource("import fs from 'node:fs'\nconst t = new Date()\n")
    assert.equal(got.class, 'tiempo-o-azar')
  })

  it('la red GANA sobre todo lo demás', () => {
    const got = classifySource("import fs from 'node:fs'\nprocess.env.X\nawait fetch('u')\n")
    assert.equal(got.class, 'red-o-dependencias')
  })

  it('reporta las señales que fundan el veredicto', () => {
    const got = classifySource('const t = Date.now()\n')
    assert.ok(got.signals.length > 0, 'un veredicto sin evidencia no es auditable')
  })
})

describe('stripComments', () => {
  it('CONTROL NEGATIVO: una señal que vive SÓLO en un comentario no clasifica', () => {
    // Éste es el control que importa. Estos módulos documentan su propio
    // comportamiento en prosa, así que una cabecera que explica "no usamos
    // Math.random() porque rompe la reproducibilidad" contiene el patrón que la
    // clasificaría como azarosa. Sin el filtro, escribir buena documentación
    // degradaría la clase del archivo: exactamente al revés de lo que queremos.
    const code = [
      '/** Evitamos Math.random() y new Date() a propósito. */',
      '// Tampoco usamos process.env acá.',
      'export const sum = (a, b) => a + b',
    ].join('\n')
    assert.equal(classifySource(code).class, PURE_CLASS.id)
  })

  it('pero la MISMA señal en código sí clasifica', () => {
    // El par del control anterior: prueba que el filtro no es un agujero que
    // deje pasar no-determinismo real, sino un corte entre prosa y código.
    const code = 'export const pick = () => Math.random()'
    assert.equal(classifySource(code).class, 'tiempo-o-azar')
  })

  it('no destruye el código que rodea al comentario', () => {
    const stripped = stripComments("const a = 1 /* nota */\nimport fs from 'node:fs'")
    assert.match(stripped, /const a = 1/)
    assert.match(stripped, /node:fs/)
  })
})

describe('summarize', () => {
  it('cuenta por clase en el orden de precedencia declarado', () => {
    const resumen = summarize({
      'a.mjs': { class: 'puro-mecanico' },
      'b.mjs': { class: 'puro-mecanico' },
      'c.mjs': { class: 'estado-fijado' },
    })
    assert.deepEqual(resumen[resumen.length - 1], { class: PURE_CLASS.id, count: 2 })
    const orden = resumen.map((r) => r.class)
    assert.deepEqual(orden, [...DETERMINISM_CLASSES.map((k) => k.id), PURE_CLASS.id])
  })
})

describe('auditDeterminism sobre el repositorio real', () => {
  it('clasifica todo módulo fuente, sin dejar huecos', () => {
    const byFile = auditDeterminism(REPO)
    const total = summarize(byFile).reduce((acc, r) => acc + r.count, 0)
    assert.equal(total, Object.keys(byFile).length, 'ningún archivo puede quedar sin clase')
    assert.ok(Object.keys(byFile).length > 50, 'el barrido debe alcanzar el árbol entero')
  })

  it('incluye scripts/scaffold/, que un filtro por nombre se comía', () => {
    const byFile = auditDeterminism(REPO)
    assert.ok(byFile['scripts/scaffold/validate-srp.mjs'], 'validate-srp debe estar clasificado')
  })

  it('excluye los tests: clasificamos fuentes, no su verificación', () => {
    const byFile = auditDeterminism(REPO)
    assert.ok(
      !Object.keys(byFile).some((k) => k.endsWith('.test.mjs')),
      'ningún .test.mjs puede entrar al inventario de fuentes',
    )
  })

  it('es estable entre corridas', () => {
    assert.equal(JSON.stringify(auditDeterminism(REPO)), JSON.stringify(auditDeterminism(REPO)))
  })
})
