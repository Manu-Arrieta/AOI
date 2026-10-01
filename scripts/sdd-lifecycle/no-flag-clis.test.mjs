/**
 * scripts/sdd-lifecycle/no-flag-clis.test.mjs
 *
 * Los dos CLIs de la fase que casi no toman flags, y que por eso nunca miraban
 * `argv`. Medido (auditoría 2026-09-30, D6): `sdd-stress-suite --help` corría la
 * suite ENTERA —con sus llamadas a ICM— y `cache-prefix --help` la auditoría
 * entera (3.160 bytes). Un typo en `--hermetic` medía el store vivo, que es
 * justo lo que el flag existe para evitar, y nada lo decía.
 *
 * El PATH del subproceso no trae `icm`: si el parseo afloja y la suite arranca,
 * no toca el store real, y el test falla por la salida, no por un efecto.
 */

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const ENV = { ...process.env, PATH: '/usr/bin:/bin' }

const run = (script, args) =>
  spawnSync(process.execPath, [path.join(HERE, script), ...args], { cwd: ROOT, env: ENV, encoding: 'utf8', timeout: 180000 })

describe('sdd-stress-suite: la ayuda no corre la suite y un flag mal escrito no mide nada', () => {
  it('--help y -h salen 0 con el uso y sin el banner de la suite', () => {
    for (const flag of ['--help', '-h']) {
      const r = run('sdd-stress-suite.mjs', [flag])
      assert.equal(r.status, 0, r.stderr)
      assert.match(r.stdout, /Uso: .*--hermetic/)
      assert.doesNotMatch(r.stdout, /STRESS TEST/, `${flag} corrió la suite`)
    }
  })

  it('--hermetc sale 2 y nombra el flag válido', () => {
    const r = run('sdd-stress-suite.mjs', ['--hermetc'])
    assert.equal(r.status, 2, r.stdout.slice(0, 300))
    assert.equal(r.stdout, '')
    assert.match(r.stderr, /Flags válidos: --hermetic --help\|-h/)
  })
})

describe('cache-prefix: no toma flags y lo dice', () => {
  it('--help sale 0 con el uso y sin correr la auditoría', () => {
    const r = run('cache-prefix.mjs', ['--help'])
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /^Uso: /)
    assert.doesNotMatch(r.stdout, /Cache Prefix Economics/)
  })

  it('un flag desconocido sale 2 sin salida', () => {
    const r = run('cache-prefix.mjs', ['--json'])
    assert.equal(r.status, 2)
    assert.equal(r.stdout, '')
    assert.match(r.stderr, /--json/)
  })
})
