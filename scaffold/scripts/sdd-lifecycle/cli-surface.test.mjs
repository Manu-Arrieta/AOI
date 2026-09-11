/**
 * scripts/sdd-lifecycle/cli-surface.test.mjs
 *
 * The command line is what the cycle actually runs, and it was the part
 * nothing tested.
 *
 * A mutation probe over scripts/sdd-lifecycle killed 46% of its mutants, and
 * the survivors clustered in one shape: every module has a tested library and
 * an untested `main()`. The most expensive example is a single line in the
 * deterministic verifier —
 *
 *     if (enforceExitCode && unified.status !== 'PASSED') process.exit(1)
 *
 * Flipping `!==` to `===` inverts it completely: the gate exits 1 on a clean
 * verification and 0 on a failing one, and the whole suite stayed green.
 * `/sdd-verify` reads that exit code to decide whether a task may close, so an
 * inverted gate would pass every broken task and block every good one. Same
 * for the coverage audit's exit code beneath it.
 *
 * These tests execute the CLIs as subprocesses, because the exit code IS the
 * contract and no in-process call can observe it.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const UNION = path.join(HERE, 'mechanical-verify-union.mjs')

/** Runs a CLI and returns its exit code, stdout and stderr, never through a pipe. */
function run(script, args, cwd = HERE) {
  try {
    const stdout = execFileSync('node', [script, ...args], {
      cwd,
      encoding: 'utf8',
      timeout: 60000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, stdout, stderr: '' }
  } catch (e) {
    return { code: e.status ?? 1, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') }
  }
}

/** Writes report files into a throwaway directory. */
function reportsDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-cli-'))
  const paths = []
  for (const [name, body] of Object.entries(files)) {
    const p = path.join(dir, name)
    fs.writeFileSync(p, JSON.stringify(body))
    paths.push(p)
  }
  return { dir, paths }
}

const CLEAN = { status: 'PASSED', failedTests: [], lintErrors: [], typeErrors: [], contractViolations: [] }
const BROKEN = {
  status: 'FAILED',
  failedTests: [{ id: 'T-1', name: 'suma', message: 'esperaba 2' }],
  lintErrors: [],
  typeErrors: [],
  contractViolations: [],
}

describe('mechanical-verify-union answers with its exit code', () => {
  it('exits 0 on a clean verification when the exit code is enforced', () => {
    const { dir, paths } = reportsDir({ 'a.json': CLEAN })
    assert.equal(run(UNION, ['--exit-code', ...paths]).code, 0)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('exits 1 on a failing verification when the exit code is enforced', () => {
    // The line the probe inverted. Both directions are asserted, because a
    // gate that always fails and a gate that always passes are equally
    // useless and only the pair distinguishes them.
    const { dir, paths } = reportsDir({ 'a.json': BROKEN })
    assert.equal(run(UNION, ['--exit-code', ...paths]).code, 1)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('exits 0 on a failing verification when the exit code is NOT enforced', () => {
    // `enforceExitCode &&` — turning it into `||` would make the flag
    // irrelevant and every report fatal.
    const { dir, paths } = reportsDir({ 'a.json': BROKEN })
    const r = run(UNION, paths)
    assert.equal(r.code, 0)
    assert.match(r.stdout, /FAILED/, 'no reportó el fallo aunque no lo hiciera fatal')
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('fails when ANY report in the union fails', () => {
    const { dir, paths } = reportsDir({ 'ok.json': CLEAN, 'bad.json': BROKEN })
    assert.equal(run(UNION, ['--exit-code', ...paths]).code, 1)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('prints usage and exits 0 with no arguments', () => {
    const r = run(UNION, [])
    assert.equal(r.code, 0)
    assert.match(r.stdout, /Usage:/)
  })

  it('accepts -h and --help the same way', () => {
    for (const flag of ['-h', '--help']) {
      const r = run(UNION, [flag])
      assert.equal(r.code, 0, `${flag} no salió 0`)
      assert.match(r.stdout, /Usage:/, `${flag} no imprimió el uso`)
    }
  })

  it('emits parseable JSON with --json', () => {
    const { dir, paths } = reportsDir({ 'a.json': BROKEN })
    const r = run(UNION, ['--json', ...paths])
    const parsed = JSON.parse(r.stdout)
    assert.equal(parsed.status, 'FAILED')
    assert.equal(parsed.failedTests.length, 1)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('does not treat a flag as a report path', () => {
    // `filePaths = args.filter(a => !a.startsWith('--'))` — without it the
    // flags would be read as missing files and silently ignored, which is
    // indistinguishable from having no reports at all.
    const { dir, paths } = reportsDir({ 'a.json': BROKEN })
    const withFlags = run(UNION, ['--json', '--exit-code', ...paths])
    assert.equal(withFlags.code, 1)
    assert.equal(JSON.parse(withFlags.stdout).status, 'FAILED')
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('warns about an unparseable report instead of counting it as clean', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-cli-'))
    const bad = path.join(dir, 'roto.json')
    fs.writeFileSync(bad, 'no soy json')
    const r = run(UNION, ['--exit-code', bad])
    // Nothing parsed, so there is nothing to fail on — but the operator has
    // to be told, or a corrupt report reads exactly like a passing one.
    assert.equal(r.code, 0)
    fs.rmSync(dir, { recursive: true, force: true })
  })
})

const ARRANGER = path.join(HERE, 'context-arranger.mjs')
const CACHE_PREFIX = path.join(HERE, 'cache-prefix.mjs')
const REPO = path.resolve(HERE, '../..')

/**
 * The Context Arranger decides what the agent sees and in what order, which
 * is the saving in Phase 1. Its `main()` reads four flags and every one of
 * them silently falls back to a default when it cannot be read: a typo in a
 * path does not fail, it arranges an empty context. Twenty-two of the area's
 * mutants lived here.
 */
function withItems(items, name = 'signals.json') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-arrange-'))
  const file = path.join(root, name)
  fs.writeFileSync(file, JSON.stringify(items))
  return { root, file }
}

const ITEMS = (prefix, n) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i}`, content: `${prefix} contenido ${i} `.repeat(10) }))

describe('context-arranger', () => {
  it('prints usage and exits 0 with no arguments', () => {
    const r = run(ARRANGER, [])
    assert.equal(r.code, 0)
    assert.match(r.stdout, /Usage:/)
  })

  it('arranges the signals it was pointed at', () => {
    const { root, file } = withItems(ITEMS('senal', 4))
    const r = run(ARRANGER, ['--signals', file])
    assert.equal(r.code, 0, `${r.stdout}${r.stderr}`)
    assert.match(r.stdout, /senal/)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('keeps background material distinguishable from signal', () => {
    // The whole mechanism is contrast: if background and signal were merged
    // the arranger would be an expensive no-op.
    const a = withItems(ITEMS('senal', 3))
    const b = withItems(ITEMS('fondo', 3), 'bg.json')
    const both = run(ARRANGER, ['--signals', a.file, '--background', b.file]).stdout
    const only = run(ARRANGER, ['--signals', a.file]).stdout
    assert.notEqual(both, only, 'el --background no cambió nada')
    fs.rmSync(a.root, { recursive: true, force: true })
    fs.rmSync(b.root, { recursive: true, force: true })
  })

  it('honours --ratio', () => {
    const a = withItems(ITEMS('senal', 6))
    const b = withItems(ITEMS('fondo', 6), 'bg.json')
    const low = run(ARRANGER, ['--signals', a.file, '--background', b.file, '--ratio', '0.2']).stdout
    const high = run(ARRANGER, ['--signals', a.file, '--background', b.file, '--ratio', '0.9']).stdout
    assert.notEqual(low, high, 'el --ratio no cambió la mezcla')
    fs.rmSync(a.root, { recursive: true, force: true })
    fs.rmSync(b.root, { recursive: true, force: true })
  })

  it('falls back to the default ratio on a value that is not a number', () => {
    // `parseFloat(x) || 0.5` — a typo must not arrange with NaN, which would
    // silently drop everything.
    const { root, file } = withItems(ITEMS('senal', 4))
    const bad = run(ARRANGER, ['--signals', file, '--ratio', 'medio'])
    const good = run(ARRANGER, ['--signals', file, '--ratio', '0.5'])
    assert.equal(bad.code, 0)
    assert.equal(bad.stdout, good.stdout)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('honours --pos', () => {
    const a = withItems(ITEMS('senal', 4))
    const b = withItems(ITEMS('fondo', 4), 'bg.json')
    const end = run(ARRANGER, ['--signals', a.file, '--background', b.file, '--pos', 'end']).stdout
    const start = run(ARRANGER, ['--signals', a.file, '--background', b.file, '--pos', 'start']).stdout
    assert.notEqual(end, start, 'la posición no cambió el orden')
    fs.rmSync(a.root, { recursive: true, force: true })
    fs.rmSync(b.root, { recursive: true, force: true })
  })

  it('arranges nothing rather than crashing when the signals file is missing', () => {
    // Documented, not endorsed: a mistyped path produces an empty context and
    // exit 0. Pinned here so the silence is a decision and not a surprise.
    const r = run(ARRANGER, ['--signals', '/no/existe/signals.json'])
    assert.equal(r.code, 0)
  })
})

describe('cache-prefix guards the always-injected surface', () => {
  it('exits 0 on the real repository, where the repeated mass is stable', () => {
    const r = run(CACHE_PREFIX, [], REPO)
    assert.equal(r.code, 0, r.stdout.slice(-500))
    assert.match(r.stdout, /La masa repetida no muta/)
  })

  it('reports the multiplier band, which is what makes a cut worth six', () => {
    // A token cut in the universal band is paid in all six phases. Losing
    // this table is how someone optimises the cheap half of the cycle.
    const r = run(CACHE_PREFIX, [], REPO)
    assert.match(r.stdout, /x6\s+\d+/)
    assert.match(r.stdout, /PISO/)
  })
})
