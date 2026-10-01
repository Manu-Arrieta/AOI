/**
 * scripts/sdd-lifecycle/cli-flags.test.mjs
 *
 * El parser estricto que comparten los CLIs. Cada caso es uno de los typos que
 * la auditoría del 2026-09-30 midió pasando en silencio: si este archivo afloja,
 * vuelven todos a la vez.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { describe, it } from 'node:test'
import { UsageError, exitOnUsageError, oneOf, parseFlags } from './cli-flags.mjs'

const OPTS = { file: { type: 'string' }, 'dry-run': { type: 'boolean' }, scope: { type: 'string', multiple: true } }

describe('parseFlags', () => {
  it('lee los flags declarados, repetidos incluidos', () => {
    const { values } = parseFlags(['--file', 'a.json', '--scope', 'x', '--scope', 'y', '--dry-run'], OPTS)
    assert.deepEqual({ ...values }, { file: 'a.json', scope: ['x', 'y'], 'dry-run': true })
  })

  it('rechaza un flag desconocido y nombra los válidos', () => {
    assert.throws(() => parseFlags(['--treshold', '5'], OPTS), (e) =>
      e instanceof UsageError && /--treshold/.test(e.message) && /--file <valor> --dry-run --scope <valor>/.test(e.message))
  })

  it('rechaza un flag de valor sin valor, y uno cuyo "valor" es otro flag', () => {
    // El bucle viejo lo IGNORABA: `--scope` al final quedaba vacío y vacío era "todos".
    assert.throws(() => parseFlags(['--scope'], OPTS), UsageError)
    assert.throws(() => parseFlags(['--file', '--dry-run'], OPTS), UsageError)
  })

  it('rechaza un argumento suelto salvo que el CLI los acepte', () => {
    assert.throws(() => parseFlags(['suelto'], OPTS), UsageError)
    assert.deepEqual(parseFlags(['suelto'], OPTS, { positionals: true }).positionals, ['suelto'])
  })

  it('dice "(ninguno)" cuando el CLI no acepta flags, y nombra el alias corto', () => {
    assert.throws(() => parseFlags(['--bogus'], {}), /Flags válidos: \(ninguno\)/)
    assert.throws(() => parseFlags(['--bogus'], { help: { type: 'boolean', short: 'h' } }), /--help\|-h/)
  })

  it('una configuración rota es un bug, no un error de uso: no sale con 2', () => {
    // Convertir TODO error en UsageError escondía un `type` mal escrito en el
    // propio CLI detrás de un "flag desconocido" que culpa al operador.
    assert.throws(() => parseFlags(['--a'], { a: { type: 'num' } }), (e) => !(e instanceof UsageError) && e instanceof TypeError)
  })
})

describe('oneOf', () => {
  it('deja pasar un valor válido y la ausencia', () => {
    assert.equal(oneOf('format', 'toon', ['markdown', 'toon']), 'toon')
    assert.equal(oneOf('format', undefined, ['markdown', 'toon']), undefined)
  })

  it('rechaza un valor fuera de la enumeración en vez de caer al default', () => {
    assert.throws(() => oneOf('format', 'yaml', ['markdown', 'toon']), (e) =>
      e instanceof UsageError && /yaml/.test(e.message) && /markdown, toon/.test(e.message))
  })
})

describe('exitOnUsageError', () => {
  it('devuelve lo que devuelve fn y deja pasar los errores que no son de uso', () => {
    assert.equal(exitOnUsageError(() => 7), 7)
    assert.throws(() => exitOnUsageError(() => { throw new TypeError('bug') }), TypeError)
  })

  it('convierte un error de uso en exit 2 con el mensaje en stderr', () => {
    // En un subproceso: `process.exit` terminaría el runner.
    const src = `import { readFlags } from ${JSON.stringify(new URL('./cli-flags.mjs', import.meta.url).href)}
readFlags(['--bogus'], { ok: { type: 'boolean' } })
console.log('no debió llegar')`
    let status = 0
    let stderr = ''
    let stdout = ''
    try {
      stdout = execFileSync(process.execPath, ['--input-type=module', '-e', src], { encoding: 'utf8', stdio: 'pipe' })
    } catch (e) {
      ;({ status, stderr, stdout } = e)
    }
    assert.equal(status, 2)
    assert.match(stderr, /--bogus/)
    assert.match(stderr, /Flags válidos: --ok/)
    assert.equal(stdout, '')
  })
})
