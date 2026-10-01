/**
 * scripts/conf/icm-isolation.test.mjs
 *
 * `setup.sh` con una base de ICM aislada (`AOI_ICM_DB` / `--icm-db`).
 *
 * El defecto, medido el 2026-09-30: ~35 topics `aoi-*-context` de workspaces de
 * prueba estaban en la base REAL del desarrollador, y `aoi:installed-suite`
 * ejecutaba `icm init --mode hook|skill|cli` contra su `~/.claude/`. Ninguna
 * llamada a `icm` del instalador llevaba `--db`, y `ICM_DB` en el entorno no
 * aísla (con una base vacía en `ICM_DB`, `icm --read-only topics` devolvió los
 * 425 topics reales).
 *
 * Se ejecuta el código REAL del instalador —el shim y las funciones que lo
 * enrutan se extraen de `setup.sh`— contra un `icm` de mentira que registra lo
 * que recibe. El directorio lleva un espacio a propósito: el repositorio vive en
 * `GITHUB MIGRATION/`, y un shim que interpolara rutas se partiría ahí.
 */

import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { isolatedIcm, isolatedIcmShim } from '../scaffold/installed-suite.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SETUP = fs.readFileSync(path.join(REPO, 'setup.sh'), 'utf8')

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi icm aislado '))
after(() => fs.rmSync(ROOT, { recursive: true, force: true }))

/** Un `icm` "real" de mentira: anota cada invocación, un argumento por línea. */
function stubRealIcm(name) {
  const dir = path.join(ROOT, `${name} bin`)
  fs.mkdirSync(dir, { recursive: true })
  const log = path.join(dir, 'calls.log')
  fs.writeFileSync(
    path.join(dir, 'icm'),
    `#!/bin/sh\nfor a in "$@"; do printf '%s\\n' "$a"; done >> "${log}"\necho '--' >> "${log}"\n`,
    { mode: 0o755 },
  )
  const calls = () =>
    fs.existsSync(log)
      ? fs.readFileSync(log, 'utf8').split('--\n').filter(Boolean).map((c) => c.trimEnd().split('\n'))
      : []
  return { dir, bin: path.join(dir, 'icm'), calls }
}

function shimAt(name) {
  const file = path.join(ROOT, `${name} shim`, 'icm')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, isolatedIcmShim(REPO), { mode: 0o755 })
  return file
}

describe('el shim de icm aislado', () => {
  const real = stubRealIcm('shim')
  const shim = shimAt('shim')
  const db = path.join(ROOT, 'base con espacio', 'icm.db')
  const run = (args, env = { AOI_ICM_REAL: real.bin, AOI_ICM_DB: db }) =>
    spawnSync(shim, args, { encoding: 'utf8', timeout: 5000, killSignal: 'SIGKILL', env: { PATH: process.env.PATH, ...env } })

  it('antepone --db a TODA llamada y respeta argumentos con espacios', () => {
    const antes = real.calls().length
    const r = run(['store', '-t', 'ws-context', '-c', 'texto con espacios'])
    assert.equal(r.status, 0, r.stderr)
    assert.deepEqual(real.calls().slice(antes), [
      ['--db', db, 'store', '-t', 'ws-context', '-c', 'texto con espacios'],
    ])
  })

  it('NO ejecuta los modos que escriben en ~/.claude: init, uninstall, upgrade', () => {
    const antes = real.calls().length
    for (const args of [['init', '--mode', 'hook'], ['init', '--mode', 'cli'], ['--no-embeddings', 'init'], ['uninstall'], ['upgrade']]) {
      const r = run(args)
      assert.equal(r.status, 3, `icm ${args.join(' ')} tenía que negarse`)
    }
    assert.equal(real.calls().length, antes, 'el icm real no debió recibir ninguna')
  })

  it('"init" como VALOR de un argumento no es el subcomando', () => {
    const antes = real.calls().length
    assert.equal(run(['store', '-c', 'init']).status, 0)
    assert.equal(real.calls().length, antes + 1)
  })

  it('un AOI_ICM_REAL que apunta a un shim se niega en vez de girar sin fin', () => {
    // Medido el 2026-10-01: resuelto por PATH con el shim ya delante, el shim
    // se re-ejecutaba a sí mismo sumando un `--db` por vuelta, sin terminar.
    const r = run(['topics'], { AOI_ICM_REAL: shim, AOI_ICM_DB: db })
    assert.equal(r.error?.code, undefined, 'el shim no terminó: se ejecutó a sí mismo')
    assert.equal(r.status, 3)
    assert.match(r.stderr, /es otro shim/)
  })

  it('falla cerrado: sin AOI_ICM_DB no cae a la base real', () => {
    const antes = real.calls().length
    const r = run(['topics'], { AOI_ICM_REAL: real.bin })
    assert.equal(r.status, 3)
    assert.equal(real.calls().length, antes)
  })
})

/** Las funciones del instalador que enrutan `icm`, ejecutadas tal cual. */
function setupFunctions() {
  const fn = (name) => {
    const m = SETUP.match(new RegExp(`^${name}\\(\\) \\{[\\s\\S]*?\\n\\}`, 'm'))
    assert.ok(m, `setup.sh ya no define ${name}()`)
    return m[0]
  }
  return ['info() { :; }', 'err() { :; }', ...['write_isolated_icm_shim', 'route_icm_to_isolated_db', 'require_icm'].map(fn)].join('\n')
}

describe('setup.sh enruta cada icm, propio y de sus hijos, a la base aislada', () => {
  const real = stubRealIcm('setup')
  const db = path.join(ROOT, 'setup db', 'icm.db')
  const script = `${setupFunctions()}
AOI_ICM_SHIM_DIR=""
require_icm
require_icm
icm facts set ws harness.selected claude
node -e "require('child_process').execFileSync('icm', ['facts', 'list', 'ws'])"
icm init --mode hook 2>/dev/null && echo HOOK-OK || echo HOOK-SKIPPED
echo "SHIMS=$(ls "$TMPDIR" | wc -l | tr -d ' ')"
rm -rf "$AOI_ICM_SHIM_DIR"
`
  const tmp = path.join(ROOT, 'tmp de setup')
  fs.mkdirSync(tmp)
  const bash = (env) =>
    execFileSync('bash', ['-c', script], {
      encoding: 'utf8',
      env: { HOME: process.env.HOME, TMPDIR: tmp, PATH: `${real.dir}${path.delimiter}${process.env.PATH}`, ...env },
    })

  it('con AOI_ICM_DB: la llamada propia y la del hijo node llevan --db una sola vez', () => {
    const out = bash({ AOI_ICM_DB: db })
    // Tres `require_icm` en el instalador, un solo shim: la limpieza sólo
    // conoce el último, así que cualquier otro quedaría huérfano en el temporal.
    assert.match(out, /SHIMS=1\b/)
    // Dos `require_icm` seguidos: un segundo shim apilado daría `--db X --db X`,
    // que el icm real rechaza. Lo que llega tiene que ser exactamente esto.
    assert.deepEqual(real.calls(), [
      ['--db', db, 'facts', 'set', 'ws', 'harness.selected', 'claude'],
      ['--db', db, 'facts', 'list', 'ws'],
    ])
    assert.match(out, /HOOK-SKIPPED/, 'icm init escribe en ~/.claude y no debía correr')
    assert.ok(fs.existsSync(path.dirname(db)), 'el directorio de la base se crea')
  })

  it('sin AOI_ICM_DB nada cambia: una instalación real usa la base del Owner', () => {
    const real2 = stubRealIcm('setup real')
    execFileSync('bash', ['-c', script], {
      encoding: 'utf8',
      env: { HOME: process.env.HOME, PATH: `${real2.dir}${path.delimiter}${process.env.PATH}` },
    })
    assert.deepEqual(real2.calls(), [
      ['facts', 'set', 'ws', 'harness.selected', 'claude'],
      ['facts', 'list', 'ws'],
      ['init', '--mode', 'hook'],
    ])
  })
})

describe('setup.sh: la entrada de la base aislada', () => {
  it('acepta --icm-db en las dos formas', () => {
    assert.match(SETUP, /--icm-db\)\s*\n\s*AOI_ICM_DB="\$2"/)
    assert.match(SETUP, /--icm-db=\*\)\s*\n\s*AOI_ICM_DB="\$\{1#\*=\}"/)
  })

  it('ninguna llamada a icm —salvo --version— corre antes del primer require_icm', () => {
    // El shim se instala en require_icm. Una llamada que lo precediera iría a la
    // base real aunque el Owner haya pedido aislamiento.
    const lines = SETUP.replace(/<<'AOI_ICM_SHIM'[\s\S]*?\nAOI_ICM_SHIM\n/, '\n').split('\n')
    const firstRequire = lines.findIndex((l) => /^require_icm\s*$/.test(l))
    assert.ok(firstRequire > 0, 'setup.sh ya no llama a require_icm en el flujo principal')
    const tempranas = lines
      .map((l, i) => ({ l, i }))
      .filter(({ l, i }) => i < firstRequire && !/^\s*#/.test(l))
      // Posición de COMANDO, no texto: "...without a working icm command" en un
      // `err` no es una llamada.
      .filter(({ l }) => /(^\s*|[;&|]\s*|\bif\s+|!\s+|\$\()icm\s+(?!--version)/.test(l))
    assert.deepEqual(tempranas, [])
  })
})

describe('aoi:installed-suite construye el mismo aislamiento', () => {
  it('su icm reenvía a la base propia de la corrida, con el shim de setup.sh', () => {
    const real = stubRealIcm('suite')
    const icm = isolatedIcm(REPO, { realIcm: real.bin })
    try {
      assert.ok(icm.db.startsWith(icm.dir), 'la base vive dentro del temporal de la corrida')
      assert.equal(icm.env.AOI_ICM_DB, icm.db)
      execFileSync('icm', ['topics'], { env: { ...process.env, ...icm.env } })
      assert.deepEqual(real.calls(), [['--db', icm.db, 'topics']])
    } finally {
      fs.rmSync(icm.dir, { recursive: true, force: true })
    }
  })

  it('sin icm real devuelve null en vez de un aislamiento que no aísla', () => {
    assert.equal(isolatedIcm(REPO, { realIcm: null }), null)
  })
})
