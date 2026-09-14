/**
 * scripts/sdd-lifecycle/benchmark-inputs.test.mjs
 *
 * El contrato de la huella de insumos. Lo que se fija acá no es "devuelve un
 * número" sino las tres propiedades de las que depende que un delta se pueda
 * interpretar: la huella distingue contenido, distingue archivos, y no explota
 * cuando falta uno.
 */

import assert from 'node:assert/strict'
import path from 'node:path'
import { describe, it } from 'node:test'
import { FIXED_BENCHMARK_INPUTS, fingerprintInputs, formatComparability } from './benchmark-inputs.mjs'

/** Un lector de mentira: mide la función, no el árbol de archivos real. */
const lector = (mapa) => (f) => {
  if (!(f in mapa)) throw new Error(`no existe: ${f}`)
  return mapa[f]
}

describe('fingerprintInputs', () => {
  it('suma los bytes de todos los archivos', () => {
    const r = fingerprintInputs(['a.mjs', 'b.ts'], lector({ 'a.mjs': 'x'.repeat(100), 'b.ts': 'y'.repeat(250) }))
    assert.equal(r.bytes, 350)
    assert.equal(r.files, 2)
    assert.deepEqual(r.missing, [])
  })

  it('cambiar el contenido cambia la huella', () => {
    // La propiedad de la que depende todo: si la huella no cambiara con el
    // insumo, no serviría para distinguir un delta del mecanismo de uno del
    // archivo.
    const a = fingerprintInputs(['a.mjs'], lector({ 'a.mjs': 'uno' }))
    const b = fingerprintInputs(['a.mjs'], lector({ 'a.mjs': 'dos' }))
    assert.notEqual(a.digest, b.digest, 'dos contenidos distintos dieron la misma huella')
  })

  it('repartir el mismo contenido en dos archivos cambia la huella', () => {
    // Sin el separador entre entradas, `'ab'` + `'c'` y `'a'` + `'bc'` dan la
    // misma cadena concatenada y por lo tanto la misma huella: dos insumos
    // distintos reportados como idénticos.
    const uno = fingerprintInputs(['a.mjs', 'b.mjs'], lector({ 'a.mjs': 'ab', 'b.mjs': 'c' }))
    const dos = fingerprintInputs(['a.mjs', 'b.mjs'], lector({ 'a.mjs': 'a', 'b.mjs': 'bc' }))
    assert.notEqual(uno.digest, dos.digest, 'la concatenación confundió dos insumos distintos')
    assert.equal(uno.bytes, dos.bytes, 'los bytes sí coinciden: es la huella la que debe distinguir')
  })

  it('un archivo que falta se reporta, no se ignora en silencio', () => {
    // La dirección peligrosa: contar 0 bytes de un archivo ausente haría que la
    // huella describa un insumo incompleto sin decirlo, y el lector creería que
    // el insumo se achicó.
    const r = fingerprintInputs(['a.mjs', 'no-esta.ts'], lector({ 'a.mjs': 'x' }))
    assert.deepEqual(r.missing, ['no-esta.ts'])
    assert.equal(r.files, 2, 'el total de declarados no cambia')
    assert.equal(r.bytes, 1)
  })

  it('sin archivos da una huella estable y cero bytes', () => {
    const r = fingerprintInputs([], lector({}))
    assert.equal(r.bytes, 0)
    assert.equal(r.files, 0)
    assert.match(r.digest, /^[0-9a-f]{16}$/)
  })
})

describe('formatComparability', () => {
  const fpFalso = () => ({ bytes: 21376, files: 2, missing: [], digest: '51582d2a391a8dd6' })

  it('nombra los archivos, su peso y su huella', () => {
    const out = formatComparability('/x', FIXED_BENCHMARK_INPUTS, fpFalso)
    assert.match(out, /21376 bytes/, 'no trajo el peso')
    assert.match(out, /51582d2a391a8dd6/, 'no trajo la huella')
    assert.match(out, /coeffect-resolver\.mjs/, 'no nombró los archivos')
  })

  it('declara la regla de interpretación, que es lo que hace útil al número', () => {
    // Sin la regla, el bloque es dato sin consecuencia: alguien ve el peso y no
    // sabe qué hacer con él.
    const out = formatComparability('/x', FIXED_BENCHMARK_INPUTS, fpFalso)
    assert.match(out, /si la huella cambió, el insumo cambió/i, 'no explicó cómo leer un delta')
    assert.match(out, /% de reducción.*comparable|comparable entre revisiones/i, 'no aclaró qué sí es comparable')
  })

  it('avisa cuando falta un archivo del insumo', () => {
    const out = formatComparability('/x', FIXED_BENCHMARK_INPUTS, () => ({
      bytes: 1,
      files: 2,
      missing: ['x.ts'],
      digest: 'aaaaaaaaaaaaaaaa',
    }))
    assert.match(out, /faltan 1/, 'no avisó del archivo ausente')
  })

  it('el insumo declarado no está vacío y apunta a la fase de AST-Lens', () => {
    // Un cambio que borre la declaración dejaría el bloque vacío y el reporte sin
    // la advertencia, sin que nada lo note.
    assert.ok(FIXED_BENCHMARK_INPUTS.length > 0, 'no hay insumos declarados')
    const p3 = FIXED_BENCHMARK_INPUTS.find((i) => i.phase === 'Phase_3_Apply')
    assert.ok(p3, 'no declaró los insumos de Phase_3_Apply')
    assert.equal(p3.files.length, 2, 'AST-Lens mide dos archivos')
    for (const f of p3.files) {
      assert.ok(f.length > 0 && !path.isAbsolute(f), `la ruta no es relativa: ${f}`)
    }
  })
})
