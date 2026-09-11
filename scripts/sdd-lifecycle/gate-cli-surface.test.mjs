/**
 * scripts/sdd-lifecycle/gate-cli-surface.test.mjs
 *
 * The command line of the Invariant Gate — the compuerta that decides
 * whether a Behavioral Intent Contract is actually enforced by a test, and
 * whose exit code /sdd-verify reads to decide if a task may close.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const GATE = path.join(HERE, 'invariant-gate.mjs')

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

/**
 * The Invariant Gate is the compuerta that decides whether a Behavioral Intent
 * Contract is actually enforced by a test, and `/sdd-verify` reads its exit
 * code to decide whether a task may close. Its `main()` distinguishes three
 * outcomes — PASSED/SKIPPED (0), FAILED (1) and BLOCKED (2) — and the whole
 * point of the third is that a broken toolchain must never read as compliance:
 * absence of evidence is not evidence of enforcement.
 *
 * None of those three exits had a test. The mutation probe flipped the
 * conditions behind each one and the suite stayed green.
 */
function gateWorkspace({ facts = '', tests = {}, packageJson = null } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-gate-'))
  fs.writeFileSync(path.join(root, 'facts.txt'), facts)
  fs.mkdirSync(path.join(root, 'test'), { recursive: true })
  for (const [name, body] of Object.entries(tests)) {
    fs.writeFileSync(path.join(root, 'test', name), body)
  }
  if (packageJson) fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(packageJson))
  return root
}

const FACTS_ONE_RULE = [
  'key                              value',
  '------------------------------------------------------------',
  'bic.FIXTURE-900.never.1          NUNCA cobrar dos veces la misma orden',
].join('\n')

const COVERING_TEST = `
// Cubre FIXTURE-900:never.1
import assert from 'node:assert/strict'
assert.ok(true)
`

describe('invariant-gate answers with three distinct exit codes', () => {
  it('exits 0 and documents the codes with --help', () => {
    const r = run(GATE, ['--help'])
    assert.equal(r.code, 0)
    assert.match(r.stdout, /Usage:/)
    // The usage text IS the contract other phases read; all three must be named.
    for (const line of [/0\s+PASSED or SKIPPED/, /1\s+FAILED/, /2\s+BLOCKED/]) {
      assert.match(r.stdout, line, `el uso no documenta ${line}`)
    }
  })

  it('BLOCKS with 2 when given neither --entity nor --facts-file', () => {
    const r = run(GATE, ['--exit-code'])
    assert.equal(r.code, 2)
  })

  it('BLOCKS with 2 when the facts file does not exist', () => {
    // The distinct code matters: a missing contract is a broken toolchain, not
    // a satisfied one, and 2 is what tells the caller to stop rather than pass.
    const r = run(GATE, ['--facts-file', '/no/existe/facts.txt', '--exit-code'])
    assert.equal(r.code, 2)
    assert.match(r.stderr, /BLOCKED/)
  })

  it('FAILS with 1 when a declared rule has no test asserting it', () => {
    const root = gateWorkspace({ facts: FACTS_ONE_RULE })
    const r = run(GATE, ['--facts-file', path.join(root, 'facts.txt'), '--tests-dir', root, '--exit-code'])
    assert.equal(r.code, 1)
    assert.match(r.stdout, /FAILED/)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('does NOT fail without --exit-code, but still reports FAILED', () => {
    // `enforceExitCode &&` — flipping it to `||` would make every report fatal
    // and the flag meaningless.
    const root = gateWorkspace({ facts: FACTS_ONE_RULE })
    const r = run(GATE, ['--facts-file', path.join(root, 'facts.txt'), '--tests-dir', root])
    assert.equal(r.code, 0)
    assert.match(r.stdout, /FAILED/)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('PASSES with 0 when a test cites the rule tag', () => {
    const root = gateWorkspace({ facts: FACTS_ONE_RULE, tests: { 'a.test.mjs': COVERING_TEST } })
    const r = run(GATE, ['--facts-file', path.join(root, 'facts.txt'), '--tests-dir', root, '--exit-code'])
    assert.equal(r.code, 0, `esperaba PASSED:\n${r.stdout}${r.stderr}`)
    assert.match(r.stdout, /PASSED/)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('SKIPS with 0 when the workspace declares no BIC rules at all', () => {
    // SKIPPED must not be fatal — a workspace without a contract has nothing
    // to enforce — but it must also not read as PASSED, and the report says so.
    const root = gateWorkspace({ facts: 'key   value\n-----\ntask.TASK-2026-004.status   archived\n' })
    const r = run(GATE, ['--facts-file', path.join(root, 'facts.txt'), '--tests-dir', root, '--exit-code'])
    assert.equal(r.code, 0)
    assert.match(r.stdout, /SKIPPED/)
    assert.doesNotMatch(r.stdout, /\bPASSED\b/)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('treats a test that records a contradiction as NOT covering the rule', () => {
    // A live cycle produced exactly this: the agent found the contract
    // self-contradictory, pinned the disputed point and said so. Honest — but
    // a contract nobody can satisfy must not ship reported as enforced.
    const root = gateWorkspace({
      facts: FACTS_ONE_RULE,
      tests: { 'a.test.mjs': '// FIXTURE-900:never.1 — CONTRADICTION PENDING OWNER RESOLUTION\n' },
    })
    const r = run(GATE, ['--facts-file', path.join(root, 'facts.txt'), '--tests-dir', root, '--exit-code'])
    assert.equal(r.code, 1)
    assert.match(r.stdout + r.stderr, /contradicci/i)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('narrows the audit to one contract with --bic', () => {
    const facts = [
      'key                              value',
      '------------------------------------------------------------',
      'bic.FIXTURE-900.never.1          NUNCA cobrar dos veces',
      'bic.FIXTURE-901.never.1          NUNCA borrar sin confirmar',
    ].join('\n')
    const root = gateWorkspace({ facts, tests: { 'a.test.mjs': COVERING_TEST } })
    const base = ['--facts-file', path.join(root, 'facts.txt'), '--tests-dir', root, '--json']

    const all = JSON.parse(run(GATE, base).stdout)
    assert.equal(all.totalRules, 2)

    const filtered = JSON.parse(run(GATE, [...base, '--bic', 'FIXTURE-900']).stdout)
    assert.equal(filtered.totalRules, 1)
    assert.equal(filtered.status, 'PASSED')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('emits parseable JSON with --json', () => {
    const root = gateWorkspace({ facts: FACTS_ONE_RULE })
    const audit = JSON.parse(run(GATE, ['--facts-file', path.join(root, 'facts.txt'), '--tests-dir', root, '--json']).stdout)
    assert.equal(audit.status, 'FAILED')
    assert.equal(audit.totalRules, 1)
    assert.equal(audit.uncovered.length, 1)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('says out loud when a test is ignored because no runner collects it', () => {
    // A contract uncovered because its test is unreachable looks identical to
    // one nobody wrote, and the difference is the whole fix.
    const root = gateWorkspace({
      facts: FACTS_ONE_RULE,
      tests: { 'a.test.mjs': COVERING_TEST },
      packageJson: { scripts: { test: 'node --test otra-carpeta/*.test.mjs' } },
    })
    const r = run(GATE, ['--facts-file', path.join(root, 'facts.txt'), '--tests-dir', root, '--exit-code'])
    assert.match(r.stderr, /ningún runner los colecta/)
    assert.equal(r.code, 1, 'un test inalcanzable no puede seguir contando como cobertura')
    fs.rmSync(root, { recursive: true, force: true })
  })
})
