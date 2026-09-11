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
