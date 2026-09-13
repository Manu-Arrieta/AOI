/**
 * scripts/code-lens/code-scanner-contract.test.mjs
 *
 * El contrato de las dos piezas que COMPRIMEN: el escáner léxico compartido y la
 * regla que decide qué llave se pliega.
 *
 * Va aparte de `skeletonizer-validity.test.mjs` por un corte real, no por límite
 * de líneas: ese archivo pregunta **qué propiedades tiene la salida sobre el
 * repositorio entero** —compila, no pierde declaraciones— y corre en segundos
 * porque recorre el árbol. Éste pregunta **qué hace cada regla sobre una entrada
 * chica**, y es donde se fija la conducta que el otro archivo sólo observa.
 *
 * Las dos reglas que se prueban acá nacieron de defectos medidos: el escáner era
 * dos implementaciones que divergieron (cinco archivos con esqueleto inválido,
 * A.20), y el plegador trataba toda llave como un cuerpo, así que un import
 * multilínea quedaba VACÍO y con él se perdía lo único que un agente necesita
 * para escribir código correcto.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { skeletonizeCode } from './ast-skeletonizer.mjs'
import { scanNonStructural } from './code-scanner.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))

describe('una FORMA no se pliega: plegarla borra el contrato', () => {
  // El plegador trataba toda llave como un cuerpo. Medido, eso destruía las tres
  // formas donde vive el contrato del archivo:
  //
  //   import { folded } from './x.mjs'        → el import queda VACÍO
  //   export { folded }                       → el re-export queda VACÍO
  //   export const config = { folded }        → el objeto pierde sus claves
  //
  // Y es el peor modo de falla del instrumento: lo que un agente necesita para
  // escribir código correcto es exactamente qué importa y qué expone el archivo,
  // y era lo único que el esqueleto ocultaba. El encabezado prometía conservar
  // imports y firmas; para un import multilínea no lo hacía, y nadie lo miraba.
  const conserva = (src, simbolos) => {
    const out = skeletonizeCode(src)
    const faltan = simbolos.filter((s) => !new RegExp(`\\b${s}\\b`).test(out))
    assert.deepEqual(faltan, [], `el esqueleto perdió ${faltan.join(', ')}`)
    return out
  }

  it('conserva los nombres de un import multilínea', () => {
    conserva("import {\n  alfa,\n  beta,\n  gama,\n} from './x.mjs'\n", ['alfa', 'beta', 'gama'])
  })

  it('conserva los nombres de un `import type` multilínea', () => {
    conserva("import type {\n  Alfa,\n  Beta,\n  Gama,\n} from './t.ts'\n", ['Alfa', 'Beta', 'Gama'])
  })

  it('conserva los nombres de un re-export multilínea', () => {
    conserva('export {\n  alfa,\n  beta,\n  gama,\n}\n', ['alfa', 'beta', 'gama'])
  })

  it('conserva las claves de un objeto exportado multilínea', () => {
    conserva('export const config = {\n  alfa: 1,\n  beta: 2,\n  gama: 3,\n}\n', ['alfa', 'beta', 'gama'])
  })

  it('conserva los campos de una interface multilínea', () => {
    conserva('export interface C {\n  alfa: number\n  beta: string\n  gama: boolean\n}\n', ['alfa', 'beta', 'gama'])
  })

  // Los controles importan tanto como los casos: una regla que conserva TODO
  // también deja de comprimir, y el instrumento se desactiva por inútil.
  it('CONTROL: un cuerpo de función SÍ se pliega', () => {
    const out = skeletonizeCode('export function f(a) {\n  const w = 1\n  const x = 2\n  const y = 3\n  const z = 4\n  return w\n}\n')
    assert.match(out, /folded/, 'dejó de plegar el cuerpo de una función')
  })

  it('CONTROL: una arrow SÍ se pliega', () => {
    const out = skeletonizeCode('export const g = (a) => {\n  const w = 1\n  const x = 2\n  const y = 3\n  const z = 4\n  return w\n}\n')
    assert.match(out, /folded/, 'dejó de plegar el cuerpo de una arrow')
  })

  it('CONTROL: el cuerpo de una clase SÍ se pliega', () => {
    const out = skeletonizeCode('export class K {\n  m() {\n    const w = 1\n    const x = 2\n    const y = 3\n    const z = 4\n    return w\n  }\n}\n')
    assert.match(out, /folded/, 'dejó de plegar el cuerpo de un método')
  })
})

describe('las dos pasadas del plegador comparten el escáner', () => {
  // La compuerta que impide la re-divergencia, y es la lección de A.13 aplicada:
  // *si dos partes tienen que coincidir en cómo leen lo mismo, tienen que
  // compartir el código que lo lee*. Antes había dos escaneos —el externo saltaba
  // comentarios, el interno no— y la diferencia era el defecto. Un comentario que
  // nombre las funciones no debe romper esto.
  const source = () =>
    fs
      .readFileSync(path.join(HERE, 'ast-skeletonizer.mjs'), 'utf8')
      .split('\n')
      .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
      .join('\n')

  it('no volvió a tener un contador de strings propio', () => {
    const src = source()
    assert.doesNotMatch(src, /inString/, 'reapareció el escáner interno que causó los cinco archivos rotos')
    assert.doesNotMatch(src, /function skipRegex|function isRegexStart/, 'el escaneo léxico volvió a este archivo')
  })

  it('usa scanNonStructural en el recorrido externo y en el contador interno', () => {
    const llamadas = source().match(/scanNonStructural\(/g) ?? []
    assert.equal(llamadas.length, 2, `esperaba las dos pasadas usando el escáner compartido, encontré ${llamadas.length}`)
  })
})

describe('el escáner compartido, caso por caso', () => {
  it('salta un comentario de línea hasta el salto, no hasta el fin del archivo', () => {
    const src = "// uno\nconst a = 1\n"
    const r = scanNonStructural(src, 0)
    assert.equal(src.slice(r.end), 'const a = 1\n')
    assert.equal(r.newlines, 1)
  })

  it('un string de una línea termina en el salto aunque no tenga cierre', () => {
    // La defensa que acota el daño: en JS un string no cruza un `\n` sin
    // escapar, así que un apóstrofo suelto corta ahí en vez de comerse el archivo.
    const src = "// it doesn't\nconst a = 1\n"
    const r = scanNonStructural(src, 0)
    assert.equal(src.slice(r.end), 'const a = 1\n', 'el comentario se comió el resto del archivo')
  })

  it('cuenta los saltos de un bloque de comentario', () => {
    const r = scanNonStructural('/* a\nb\nc */resto', 0)
    assert.equal(r.newlines, 2)
    assert.equal(r.end, '/* a\nb\nc */'.length)
  })

  it('devuelve null cuando no hay nada que saltar', () => {
    assert.equal(scanNonStructural('const a = 1', 0), null)
    assert.equal(scanNonStructural('a / b', 2), null, 'una división no es una región no estructural')
  })

  it('recorre una interpolación con llaves y strings adentro', () => {
    const src = '`x ${ { a: "}" } } y` luego'
    const r = scanNonStructural(src, 0)
    assert.equal(src.slice(r.end), ' luego', 'la interpolación no cerró donde debía')
  })
})
