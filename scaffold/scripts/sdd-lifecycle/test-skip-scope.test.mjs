/**
 * scripts/sdd-lifecycle/test-skip-scope.test.mjs
 *
 * C4 de la auditoría 2026-09-30: ¿el test que cita un tag corre en esta
 * plataforma? Los tags de acá son de fixture a propósito: un tag real de un BIC
 * citado en este archivo contaría como evidencia para el Invariant Gate.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { closing, evaluateSkip, skipScope, tagSkippedOn, testCalls } from './test-skip-scope.mjs'

const TAG = 'FIXTURE-777:never.1'

describe('evaluateSkip decide sólo lo que se puede decidir sin ejecutar', () => {
  it('compara process.platform con un string, en los dos órdenes', () => {
    assert.equal(evaluateSkip("process.platform !== 'win32'", 'darwin'), true)
    assert.equal(evaluateSkip("process.platform !== 'win32'", 'win32'), false)
    assert.equal(evaluateSkip("'darwin' === process.platform", 'darwin'), true)
  })

  it('literales: true y un motivo saltan; false no', () => {
    assert.equal(evaluateSkip('true', 'darwin'), true)
    assert.equal(evaluateSkip("'sin backend'", 'darwin'), true)
    assert.equal(evaluateSkip('false', 'darwin'), false)
  })

  it('os.platform() cuenta como plataforma; un valor que no es plataforma salta siempre', () => {
    assert.equal(evaluateSkip("os.platform() !== 'win32'", 'darwin'), true)
    assert.equal(skipScope("os.platform() !== 'win32'"), 'platform')
    assert.equal(skipScope("process.platform === 'darwin'"), 'platform')
    assert.equal(skipScope("process.platform !== 'windows'"), 'always')
    assert.equal(skipScope('true'), 'always')
  })

  it('lo que depende del árbol queda indeterminado, no "salta"', () => {
    assert.equal(evaluateSkip('!SETUP_PS1', 'darwin'), null)
  })
})

describe('tagSkippedOn', () => {
  it('la forma medida: un it con skip por plataforma dentro de un describe que corre', () => {
    const src = [
      "describe('d', { skip: !SETUP_PS1 }, () => {",
      `  it('${TAG} hace algo (con paréntesis)', { skip: process.platform !== 'win32' }, () => {`,
      "    assert.match(x, /\\)/)",
      '  })',
      '})',
    ].join('\n')
    assert.deepEqual(tagSkippedOn(src, TAG, 'darwin'), { skipped: true, condition: "skip: process.platform !== 'win32'", scope: 'platform' })
    assert.equal(tagSkippedOn(src, TAG, 'win32').skipped, false)
  })

  it('it.skip y describe.skip saltan a todo lo que contienen', () => {
    assert.equal(tagSkippedOn(`it.skip('${TAG}', () => {})`, TAG, 'darwin').skipped, true)
    assert.equal(tagSkippedOn(`describe.skip('d', () => { it('${TAG}', () => {}) })`, TAG, 'darwin').skipped, true)
  })

  it('it.skip, .todo y { skip: true } no corren en NINGUNA plataforma: scope always', () => {
    for (const src of [`it.skip('${TAG}', () => {})`, `it.todo('${TAG}')`, `it('${TAG}', { skip: true }, () => {})`, `it('${TAG}', { todo: 'luego' }, () => {})`]) {
      for (const platform of ['darwin', 'win32', 'linux']) assert.equal(tagSkippedOn(src, TAG, platform).scope, 'always', `${src} @ ${platform}`)
    }
  })

  it('un skip por plataforma bajo un describe.skip tampoco corre en ninguna', () => {
    const src = `describe.skip('d', () => { it('${TAG}', { skip: process.platform !== 'win32' }, () => {}) })`
    assert.deepEqual(tagSkippedOn(src, TAG, 'darwin'), { skipped: true, condition: '.skip', scope: 'always' })
  })

  it('una cita por plataforma gana sobre otra incondicional: la regla corre en algún lado', () => {
    const src = `it.skip('${TAG} a', () => {})\nit('${TAG} b', { skip: os.platform() !== 'win32' }, () => {})\n`
    assert.equal(tagSkippedOn(src, TAG, 'darwin').scope, 'platform')
  })

  it('basta UNA cita que corra para que el tag corra', () => {
    const src = `it('${TAG} a', { skip: true }, () => {})\nit('${TAG} b', () => {})\n`
    assert.equal(tagSkippedOn(src, TAG, 'darwin').skipped, false)
  })

  it('una cita fuera de toda llamada cuenta como corrida: el handshake permite citar en un comentario', () => {
    assert.equal(tagSkippedOn(`// Cubre ${TAG}\nassert.ok(true)\n`, TAG, 'darwin').skipped, false)
  })

  it('un skip en el CUERPO de un test no se lee como opción', () => {
    const src = `it('${TAG}', () => { const o = { skip: true }; assert.ok(o) })`
    assert.equal(tagSkippedOn(src, TAG, 'darwin').skipped, false)
  })
})

describe('closing balancea saltando strings, comentarios y regex', () => {
  it('ignora cierres dentro de strings, template literals, comentarios y regex', () => {
    const src = "f('a)', `b${')'}`, /\\)/, // )\n x)"
    assert.equal(closing(src, 1), src.length - 1)
  })

  it('sin balance devuelve -1 y la llamada no se atribuye', () => {
    assert.equal(closing('f(a', 1), -1)
    assert.deepEqual(testCalls(`it('${TAG}', () => {`, 'darwin'), [])
  })
})
