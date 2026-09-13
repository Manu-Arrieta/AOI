/**
 * scripts/sdd-lifecycle/real-corpus.mjs
 *
 * Builds REAL measurement inputs for the SDD token benchmark.
 *
 * A benchmark phase is only as trustworthy as the data it is fed. Synthetic
 * strings built with `.repeat()` exercise an algorithm but say nothing about
 * the volumes a real cycle moves. These helpers produce genuine inputs: source
 * files actually present in the workspace, and diagnostic output captured from
 * a test run that really fails.
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CODE_EXTENSIONS = new Set(['.mjs', '.js', '.ts', '.vue'])
const SKIP_DIRS = new Set(['node_modules', '.git', '.nuxt', '.output', 'dist', 'build', 'coverage', 'scaffold'])

/** Recursively lists code files under a directory. */
function listCodeFiles(dir, limit) {
  const out = []
  const walk = (current) => {
    if (out.length >= limit) return
    let entries = []
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (out.length >= limit) return
      if (SKIP_DIRS.has(entry.name)) continue
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (CODE_EXTENSIONS.has(path.extname(entry.name)) && !entry.name.includes('.test.')) {
        out.push(full)
      }
    }
  }
  walk(dir)
  return out
}

/**
 * Builds a discovery corpus out of real workspace files, split into signal and
 * background exactly the way `/sdd-new` would after exploring a domain: files
 * whose path or content mentions the feature keyword are signal, the rest is
 * ambient noise competing for the same context window.
 *
 * @param {string} root
 * @param {{ keyword: string, searchDir?: string, maxFiles?: number }} opts
 * @returns {{ signalItems: Array, backgroundItems: Array, sampled: number }}
 */
export function buildDiscoveryCorpus(root, { keyword, searchDir = 'scripts', maxFiles = 30 }) {
  const base = path.join(root, searchDir)
  if (!fs.existsSync(base)) return { signalItems: [], backgroundItems: [], sampled: 0 }

  const files = listCodeFiles(base, maxFiles)
  const needle = String(keyword).toLowerCase()
  const signalItems = []
  const backgroundItems = []

  for (const file of files) {
    let content
    try {
      content = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const rel = path.relative(root, file)
    // A discovery item is the file's leading declaration block, which is what
    // an exploring agent actually pulls into context per candidate.
    const item = { id: rel, content: content.split('\n').slice(0, 40).join('\n') }
    const relevant = rel.toLowerCase().includes(needle) || content.toLowerCase().includes(needle)
    ;(relevant ? signalItems : backgroundItems).push(item)
  }

  return { signalItems, backgroundItems, sampled: files.length }
}

/**
 * Runs a test that genuinely fails and one that genuinely passes, returning
 * the real runner output for both. This replaces hand-written fake stack
 * traces with diagnostics the toolchain actually emits on this machine.
 *
 * @returns {{ ok: boolean, failing: string, passing: string }}
 */
/**
 * Borra de la salida capturada todo lo que cambia entre dos corridas idénticas.
 *
 * Por qué existe, y es un defecto medido, no una precaución. `captureRealTestRun`
 * corre `node --test` y captura su stdout; ese texto se convierte en el `content`
 * de los turnos de depuración, que la Fase 3 del stress suite mide.
 *
 * Consecuencia medida: el mismo comando sobre el mismo árbol daba
 * `5844 -> 1051` una vez y `5845 -> 1052` la siguiente, y el total del payload
 * oscilaba entre 4.683 y 4.684. Eso viola la regla que gobierna todo el protocolo
 * de auditoría —*un número que no se puede reproducir con un comando no entra en
 * el informe*— **con un comando que sí es reproducible**: el instrumento medía la
 * salida de un proceso vivo y la reportaba como aritmética estática.
 *
 * Y contamina la comparación entre versiones: un ±1 token en el payload se lee
 * como una mejora o una regresión que no ocurrió.
 *
 * Son TRES fuentes, y la primera versión de esta función cubrió sólo una. Vale
 * escribirlas porque cada una necesitó su propia regla:
 *
 *   1. `(0.51675ms)` — la duración que el reporter `spec` pone entre paréntesis.
 *   2. `duration_ms 55.436` — el mismo dato como campo del resumen, y **con un
 *      espacio, no con `:`**. Una regla que exigía `[:=]` lo dejaba pasar, y con
 *      distinto número de decimales entre corridas (55.436 vs 55.907834).
 *   3. El nombre **aleatorio** del directorio temporal (`aoi-corpus-AUJDeG`), que
 *      `mkdtemp` cambia en cada corrida y aparece en cada ruta del reporte. No
 *      cambia el largo, pero hace que dos capturas nunca sean iguales byte a byte
 *      — y una captura que no se puede comparar no sirve como evidencia.
 *
 * @param {string} text
 * @param {string[]} volatilePaths rutas a reemplazar por un marcador estable
 */
export function stripVolatile(text, volatilePaths = []) {
  let out = String(text)
  for (const p of volatilePaths) {
    if (p) out = out.split(p).join('<tmp>')
  }
  return out
    .replace(/\(\s*\d+(?:\.\d+)?\s*ms\s*\)/g, '(0ms)')
    .replace(/(duration_ms\s*[:=]?\s*)\d+(?:\.\d+)?/g, '$1 0')
    .replace(/aoi-corpus-[A-Za-z0-9]+/g, 'aoi-corpus-XXXXXX')
}

export function captureRealTestRun() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-corpus-'))
  const failing = path.join(dir, 'red.test.mjs')
  const passing = path.join(dir, 'green.test.mjs')

  fs.writeFileSync(
    failing,
    [
      "import assert from 'node:assert/strict'",
      "import { describe, it } from 'node:test'",
      "function evaluate(a, b) { return a + b }",
      "describe('budget', () => {",
      "  it('reports the expected status', () => {",
      "    assert.equal(evaluate(2, 2), 5)",
      '  })',
      "  it('rejects an invalid limit', () => {",
      "    assert.throws(() => evaluate(1, 0))",
      '  })',
      '})',
      '',
    ].join('\n')
  )
  fs.writeFileSync(
    passing,
    [
      "import assert from 'node:assert/strict'",
      "import { describe, it } from 'node:test'",
      "describe('budget', () => { it('passes', () => { assert.equal(1, 1) }) })",
      '',
    ].join('\n')
  )

  // The parent may itself be a `node --test` process, which injects
  // NODE_TEST_CONTEXT and flips the child into a machine reporter, yielding
  // nothing useful. Spawn with those stripped and pin the reporter so the
  // captured diagnostics are identical however the benchmark was invoked.
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  delete env.NODE_OPTIONS

  const run = (file) => {
    try {
      return execFileSync(process.execPath, ['--test', '--test-reporter=spec', file], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env,
      })
    } catch (err) {
      // A failing test exits non-zero; its diagnostics are exactly what we want.
      return `${err.stdout || ''}${err.stderr || ''}`
    }
  }

  // Lo capturado se NORMALIZA antes de devolverlo: sin esto, las duraciones y el
  // nombre aleatorio del temporal entran al benchmark y lo vuelven
  // irreproducible. Ver `stripVolatile`.
  const result = {
    ok: true,
    failing: stripVolatile(run(failing), [dir]),
    passing: stripVolatile(run(passing), [dir]),
  }
  fs.rmSync(dir, { recursive: true, force: true })
  if (!result.failing.trim()) result.ok = false
  return result
}

/**
 * Assembles a realistic RED -> fix -> RED -> fix -> GREEN debugging sequence
 * whose turn contents are the real runner outputs captured above. Context
 * tombstoning is then measured against traffic a real session would carry.
 *
 * @param {{ failing: string, passing: string }} capture
 * @returns {Array<object>} turns for shrinkTurns()
 */
export function buildDebuggingTurns({ failing, passing }) {
  return [
    { id: '1', turnNumber: 1, tool: 'test', summary: 'RED: assertion failed', content: failing },
    { id: '2', turnNumber: 2, tool: 'edit_file', target: 'token-budget.ts', content: 'patch: correct the comparison operator' },
    { id: '3', turnNumber: 3, tool: 'test', summary: 'RED: still failing', content: failing },
    { id: '4', turnNumber: 4, tool: 'edit_file', target: 'token-budget.ts', content: 'patch: guard a limit of zero' },
    { id: '5', turnNumber: 5, tool: 'test', summary: 'GREEN: suite passed', content: passing },
  ]
}

// ── Fallbacks ───────────────────────────────────────────────────────────────
// Used only when the real capture is impossible. Kept here, beside the real
// builders, so the benchmark orchestrator never carries synthetic data inline.

/** Synthetic discovery corpus, for environments with no readable source tree. */
export function fallbackDiscoveryCorpus() {
  return {
    signalItems: Array.from({ length: 10 }, (_, i) => ({
      id: `sig-${i}`, content: 'Critical service signature and interface constraint block '.repeat(5),
    })),
    backgroundItems: Array.from({ length: 20 }, (_, i) => ({
      id: `bg-${i}`, content: 'Unrelated background workspace context and obsolete historical log '.repeat(5),
    })),
    sampled: 0,
  }
}

/** Synthetic debugging sequence, for environments where the runner cannot spawn. */
export function fallbackDebuggingTurns() {
  return [
    { id: '1', turnNumber: 1, tool: 'test', summary: 'RED test failed', content: 'Stack trace with 80 lines: '.repeat(20) },
    { id: '2', turnNumber: 2, tool: 'edit_file', target: 'fiber-health.ts', content: 'partial patch' },
    { id: '3', turnNumber: 3, tool: 'test', summary: 'Type error TS2322', content: 'Stack trace with 60 lines: '.repeat(15) },
    { id: '4', turnNumber: 4, tool: 'edit_file', target: 'fiber-health.ts', content: 'type fix' },
    { id: '5', turnNumber: 5, tool: 'test', summary: 'GREEN test passed', content: '1 passed in 2ms' },
  ]
}

/** Synthetic runner crash, for environments where the runner cannot spawn. */
export const FALLBACK_CRASH = [
  'RUN v4.1.7',
  'FAIL test/server/fiber-health.test.ts',
  "  AssertionError: expected 'stable' to equal 'degraded'",
  '    at evaluateFiberHealth (server/utils/fiber-health.ts:15:9)',
  '    at runTest (node_modules/vitest/dist/runner.js:12:3)',
  'Test Files 1 failed (1)',
].join('\n')
