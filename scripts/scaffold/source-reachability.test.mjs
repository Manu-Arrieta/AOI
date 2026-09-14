/**
 * scripts/scaffold/source-reachability.test.mjs
 *
 * The gate counts which sources no test reaches, so a defect in the counter
 * hides exactly what it was built to find. Its first version had two, and
 * both were the same mistakes this repository keeps making in its own tools:
 * an unanchored directory name that excluded `scripts/scaffold/` from the
 * scan entirely, and an import graph that stopped at a script invoked as a
 * subprocess, reporting its whole dependency tree as uncovered.
 */

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import {
  auditReachability,
  reachabilityFailures,
  reachableFromTests,
  UNREACHED_BUDGET,
} from './source-reachability.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** A throwaway tree of sources and tests under `scripts/`. */
function tree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-reach-'))
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, body)
  }
  return root
}

describe('reachability counts both ways a test can exercise a file', () => {
  it('counts a file a test imports', () => {
    const root = tree({
      'scripts/a/lib.mjs': 'export const x = 1\n',
      'scripts/a/lib.test.mjs': "import { x } from './lib.mjs'\n",
    })
    assert.ok(reachableFromTests(root).has('scripts/a/lib.mjs'))
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('counts a file a test only spawns', () => {
    // A CLI is exercised by RUNNING it. Measuring imports alone would report
    // a thorough subprocess test as no coverage and push someone to rewrite
    // a working test to satisfy the metric.
    const root = tree({
      'scripts/a/cli.mjs': 'console.log(1)\n',
      'scripts/a/cli.test.mjs': "execFileSync('node', [path.join(HERE, 'cli.mjs')])\n",
    })
    assert.ok(reachableFromTests(root).has('scripts/a/cli.mjs'))
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('counts what a spawned script imports, because running it runs those too', () => {
    const root = tree({
      'scripts/a/helper.mjs': 'export const y = 2\n',
      'scripts/a/cli.mjs': "import { y } from './helper.mjs'\n",
      'scripts/a/cli.test.mjs': "execFileSync('node', ['cli.mjs'])\n",
    })
    const reached = reachableFromTests(root)
    assert.ok(reached.has('scripts/a/cli.mjs'))
    assert.ok(reached.has('scripts/a/helper.mjs'), 'no siguió los imports del script ejecutado')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('follows imports transitively', () => {
    const root = tree({
      'scripts/a/deep.mjs': 'export const z = 3\n',
      'scripts/a/mid.mjs': "import { z } from './deep.mjs'\nexport const y = z\n",
      'scripts/a/mid.test.mjs': "import { y } from './mid.mjs'\n",
    })
    assert.ok(reachableFromTests(root).has('scripts/a/deep.mjs'))
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('does not count a file nothing mentions', () => {
    const root = tree({
      'scripts/a/huerfano.mjs': 'export const x = 1\n',
      'scripts/a/otro.test.mjs': "import assert from 'node:assert/strict'\n",
    })
    assert.equal(reachableFromTests(root).has('scripts/a/huerfano.mjs'), false)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('scans a directory named scaffold like any other', () => {
    // The first version skipped it by name, which silently dropped five real
    // source files from the count — in the tool built to find dropped files.
    const root = tree({
      'scripts/scaffold/gate.mjs': 'export const g = 1\n',
      'scripts/scaffold/gate.test.mjs': "import { g } from './gate.mjs'\n",
    })
    const audit = auditReachability(root, {})
    assert.equal(audit.scanned, 1, 'no contó la fuente bajo scripts/scaffold')
    assert.deepEqual(audit.unreached, [])
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('the ratchet', () => {
  it('reports an unreached file that no budget declares', () => {
    const root = tree({ 'scripts/a/solo.mjs': 'export const x = 1\n', 'scripts/a/n.test.mjs': 'const a = 1\n' })
    assert.deepEqual(auditReachability(root, {}).added, ['scripts/a/solo.mjs'])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('accepts an unreached file the budget declares', () => {
    const root = tree({ 'scripts/a/solo.mjs': 'export const x = 1\n', 'scripts/a/n.test.mjs': 'const a = 1\n' })
    const audit = auditReachability(root, { 'scripts/a/solo.mjs': 'motivo declarado' })
    assert.deepEqual(audit.added, [])
    assert.deepEqual(audit.stale, [])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('flags a budget entry that is now reached, so the list cannot rot', () => {
    const root = tree({
      'scripts/a/lib.mjs': 'export const x = 1\n',
      'scripts/a/lib.test.mjs': "import { x } from './lib.mjs'\n",
    })
    const audit = auditReachability(root, { 'scripts/a/lib.mjs': 'ya no corresponde' })
    assert.deepEqual(audit.stale, ['scripts/a/lib.mjs'])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('flags a budget entry for a file that no longer exists', () => {
    const root = tree({ 'scripts/a/lib.mjs': 'export const x = 1\n' })
    assert.deepEqual(auditReachability(root, { 'scripts/a/borrado.mjs': 'motivo' }).stale, ['scripts/a/borrado.mjs'])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('every shipped exemption states a reason', () => {
    for (const [file, reason] of Object.entries(UNREACHED_BUDGET)) {
      assert.ok(reason.length > 20, `${file} sin motivo suficiente`)
    }
  })

  it('holds on the real repository', () => {
    const audit = auditReachability(REPO)
    assert.ok(audit.scanned > 40, `sólo escaneó ${audit.scanned} fuentes`)
    assert.deepEqual(audit.added, [])
    assert.deepEqual(audit.stale, [])
  })

  it('no cuenta un archivo de test como fuente a alcanzar', () => {
    // El filtro de fuentes es `EXTS.includes(ext) && !n.endsWith('.test.mjs')`.
    // Con `||` la condición es siempre verdadera para un `.mjs`, así que los
    // tests entran al conjunto de fuentes — y como un test no se importa a sí
    // mismo, quedan "sin alcanzar" y la compuerta acusa a los tests de no estar
    // cubiertos. Medido el 2026-09-13: ese mutante sobrevivía.
    const dir = tree({
      'scripts/a/lib.mjs': 'export const x = 1\n',
      'scripts/a/lib.test.mjs': "import { x } from './lib.mjs'\n",
      'scripts/a/huerfano.test.mjs': "import assert from 'node:assert/strict'\n",
    })
    const audit = auditReachability(dir)
    const tests = audit.unreached.filter((f) => f.endsWith('.test.mjs'))
    assert.deepEqual(tests, [], `reportó tests como fuentes sin alcanzar: ${tests.join(', ')}`)
  })
})

/**
 * `reachabilityFailures`: la decisión de salir 0 o 1.
 *
 * Vivía adentro de `main()`, así que su mutante `failures.length > 0` a `>= 0`
 * sobrevivía: con `>=` la condición es siempre verdadera y la compuerta falla en
 * toda corrida. Es el mismo patrón que `ratchetVerdict` y el mismo daño — una
 * compuerta que falla siempre deja de leerse.
 */
describe('reachabilityFailures decide el código de salida', () => {
  it('una fuente sin alcanzar produce una falla', () => {
    const f = reachabilityFailures({ added: ['scripts/a/suelto.mjs'], stale: [] })
    assert.equal(f.length, 1)
    assert.match(f[0], /SIN ALCANZAR/)
    assert.match(f[0], /suelto\.mjs/)
  })

  it('un presupuesto vencido produce una falla distinta', () => {
    // Las dos listas tienen que dar mensajes distinguibles: el operador actúa
    // distinto según si tiene que cubrir un archivo o sacarlo de la exención.
    const f = reachabilityFailures({ added: [], stale: ['scripts/a/viejo.mjs'] })
    assert.equal(f.length, 1)
    assert.match(f[0], /PRESUPUESTO VIEJO/)
  })

  it('sin nada que reportar la lista está vacía', () => {
    // Este caso mata `> 0` mutado a `>= 0`: con una lista vacía y `>=`, la
    // condición es verdadera y el proceso sale 1 sin ninguna falla que mostrar.
    assert.deepEqual(reachabilityFailures({ added: [], stale: [] }), [])
  })

  it('suma las dos clases de falla, no una sola', () => {
    // Una implementación que se quede con `added` y pierda `stale` deja la mitad
    // de la auditoría sin reportar, y el presupuesto se pudre sin que nadie lo
    // vea.
    const f = reachabilityFailures({ added: ['a.mjs'], stale: ['b.mjs'] })
    assert.equal(f.length, 2)
    assert.match(f.join('\n'), /a\.mjs/)
    assert.match(f.join('\n'), /b\.mjs/)
  })

  it('un resultado sin las listas no explota', () => {
    // La guarda de forma: `main()` arma el objeto, y un `undefined` que llegue
    // por un cambio futuro no puede cambiar el veredicto por un TypeError.
    for (const entrada of [undefined, null, {}, { added: undefined, stale: undefined }]) {
      assert.deepEqual(reachabilityFailures(entrada), [], `explotó con: ${String(entrada)}`)
    }
  })
})

/**
 * La guarda de CLI, por spawn.
 *
 * `if (process.argv[1] && path.resolve(...) === path.resolve(...))` es invisible
 * importando el módulo: `main()` no corre, así que ninguna aserción sobre las
 * funciones exportadas la toca. Un `and→or` la desactiva y el módulo ejecuta la
 * auditoría al importarse.
 */
describe('la guarda de CLI de source-reachability', () => {
  const corre = (args) =>
    spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 30000, cwd: REPO })

  it('importar el módulo NO corre la auditoría', () => {
    // La aserción tiene DOS partes y la segunda es la que faltaba. Verificar
    // sólo que no imprime la cabecera deja pasar un import que CRASHEA: con la
    // guarda mutada a `||`, `path.resolve(process.argv[1])` recibe `undefined`
    // bajo `node -e`, tira un TypeError, y el módulo no llega a imprimir nada.
    // La primera versión de este caso pasaba por esa razón. Medido el
    // 2026-09-13: el mutante sobrevivía a una aserción que sólo miraba la
    // ausencia de la cabecera.
    const r = corre(['-e', "import('./scripts/scaffold/source-reachability.mjs')"])
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    assert.doesNotMatch(out, /AOI Source Reachability/, `el import ejecutó main(): ${out.slice(0, 200)}`)
    assert.equal(r.status, 0, `el import falló con status ${r.status}: ${out.slice(0, 300)}`)
    assert.doesNotMatch(out, /TypeError|validateString/, 'el import crasheó en vez de sólo no ejecutar')
  })

  it('correrlo como script SÍ la corre y sale 0 en el repo real', () => {
    const r = corre(['scripts/scaffold/source-reachability.mjs'])
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    assert.match(out, /AOI Source Reachability/, `no ejecutó la auditoría: ${out.slice(0, 200)}`)
    assert.equal(r.status, 0, `salió ${r.status} en el repo real: ${out.slice(0, 300)}`)
    assert.match(out, /Toda fuente se alcanza/, 'no trajo el veredicto verde')
  })
})
