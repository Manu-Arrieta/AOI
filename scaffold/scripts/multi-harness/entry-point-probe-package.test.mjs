/**
 * scripts/multi-harness/entry-point-probe-package.test.mjs
 *
 * Los dos puntos ciegos que la auditoría 2026-09-30 (C2) le midió a
 * `aoi:entry-points`, cada uno fijado por separado y después juntos.
 *
 *   · Sólo leía la prosa de `.github/`. `dashboard-command.mjs` se invoca
 *     únicamente desde `package.json`, así que la compuerta nunca lo corría.
 *   · Corría la copia bajo `os.tmpdir()`, una ruta sin espacios. La guarda rota
 *     de `dashboard-command.mjs` —`import.meta.url === 'file://' + argv[1]`— SÍ
 *     dispara ahí; donde no dispara es en el repositorio del Owner, que vive bajo
 *     "GITHUB MIGRATION". La copia escondía justamente esa clase de defecto.
 *
 * El caso de integración usa esa guarda rota, invocada sólo desde
 * `package.json`: quitar cualquiera de las dos mitades del arreglo lo pone verde.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  invokedScripts,
  NOT_RUN,
  packageScripts,
  probeEntryPoints,
  formatEntryPointReport,
  sandboxCopy,
  SANDBOX_PREFIX,
} from './entry-point-probe.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const PROBE = fileURLToPath(new URL('./entry-point-probe.mjs', import.meta.url))

/** Un árbol con `package.json` y scripts, sin prosa: lo único que lo invoca es npm. */
function fixture(scripts, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-entry-pkg-'))
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true })
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts }))
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(root, 'scripts', name), body)
  return { root, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) }
}

test('packageScripts lee los `node scripts/...` de package.json y deja afuera los tests', () => {
  const { root, cleanup } = fixture(
    {
      a: 'node scripts/a.mjs build',
      b: 'node scripts/b.mjs && node --test scripts/b.test.mjs',
      c: 'node scripts/c.test.mjs',
    },
    {}
  )
  try {
    assert.deepEqual(packageScripts(root), ['scripts/a.mjs', 'scripts/b.mjs'])
    // Y entran en el conjunto que la compuerta corre, aunque ninguna prosa los nombre.
    assert.deepEqual(invokedScripts(root), ['scripts/a.mjs', 'scripts/b.mjs'])
  } finally {
    cleanup()
  }
})

test('este repositorio: la compuerta ve a dashboard-command, que sólo invoca package.json', () => {
  // El script de C1. Sin la lectura de package.json no está en el conjunto.
  assert.ok(invokedScripts(ROOT).includes('scripts/multi-harness/dashboard-command.mjs'))
})

test('una ruta exenta se cuenta y se reporta, pero no se corre', () => {
  const { root, cleanup } = fixture({ a: 'node scripts/caro.mjs' }, { 'caro.mjs': 'export {}\n' })
  try {
    const r = probeEntryPoints({
      root,
      run: () => {
        throw new Error('una ruta exenta no se corre')
      },
      notRun: { 'scripts/caro.mjs': 'cuesta minutos' },
    })
    assert.equal(r.checked, 1)
    assert.deepEqual(r.silent, [])
    assert.deepEqual(r.skipped, [{ file: 'scripts/caro.mjs', reason: 'cuesta minutos' }])
    // El verde dice qué no midió: un verde parcial no se lee como completo.
    assert.match(formatEntryPointReport(r), /NO se corrieron:\n {3}· scripts\/caro\.mjs — cuesta minutos/)
  } finally {
    cleanup()
  }
})

test('cada exención nombra un script que existe y que alguien invoca', () => {
  // Una exención de un script que ya nadie invoca es un hueco esperando su
  // próximo inquilino: se la borra en vez de dejarla.
  const invoked = new Set(invokedScripts(ROOT))
  for (const rel of Object.keys(NOT_RUN)) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `${rel} está exento y no existe`)
    assert.ok(invoked.has(rel), `${rel} está exento y nadie lo invoca`)
  }
})

test('la copia del sandbox vive bajo un directorio cuyo nombre lleva un espacio', () => {
  assert.match(SANDBOX_PREFIX, / /)
  const { root, cleanup } = fixture({}, { 'x.mjs': 'export {}\n' })
  let work
  try {
    work = sandboxCopy(root)
    assert.match(path.basename(work), / /)
    assert.ok(fs.existsSync(path.join(work, 'scripts', 'x.mjs')))
  } finally {
    if (work) fs.rmSync(work, { recursive: true, force: true })
    cleanup()
  }
})

test('C2: main() sale 1 ante la guarda rota de C1 invocada sólo desde package.json', () => {
  // La guarda exacta de `dashboard-command.mjs` antes del arreglo. Bajo una
  // ruta sin espacios imprime y la compuerta la daría por buena; bajo la copia
  // con espacio sale 0 muda, que es lo que pasaba en el repositorio del Owner.
  const ROTA = "if (import.meta.url === `file://${process.argv[1]}`) console.log('corrí')\n"
  const { root, cleanup } = fixture({ 'test:x': 'node scripts/rota.mjs test' }, { 'rota.mjs': ROTA })
  try {
    let code = 0
    let out = ''
    try {
      out = execFileSync('node', [PROBE], { cwd: root, encoding: 'utf8', timeout: 30000 })
    } catch (e) {
      code = e.status ?? 1
      out = `${e.stdout ?? ''}${e.stderr ?? ''}`
    }
    assert.equal(code, 1, `esperaba exit 1, salió ${code}:\n${out}`)
    assert.match(out, /scripts\/rota\.mjs — sale 0 sin imprimir nada/)
  } finally {
    cleanup()
  }
})
