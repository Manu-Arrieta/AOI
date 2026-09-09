/**
 * scripts/scaffold/gate-exit-codes.test.mjs
 *
 * `pnpm test` is a chain of `&&` over seven CLI gates. Every one of them
 * decides pass or fail by its exit code, and until this file existed not a
 * single test asserted that any of them ever exits non-zero.
 *
 * The audit verified by hand that all seven do detect their violation today.
 * That is the state this file freezes: a gate that silently starts exiting 0
 * would turn the whole suite green over a real defect, and nothing else in the
 * repository would notice — which is precisely the pathology these gates were
 * written to prevent, turned against them.
 *
 * Each case builds an isolated copy of the repository, injects the exact
 * violation the gate claims to catch, and runs the real CLI. The copy is what
 * makes this safe: fault injection never touches the working tree.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, describe, it } from 'node:test'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** Directories that would make the copy enormous and that no gate reads. */
const SKIP = new Set(['node_modules', '.git', '.nuxt', 'dist', '.venv'])

let SANDBOX = ''

/** Recursively copies the repository into a throwaway directory. */
function mirror(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue
    const from = path.join(src, e.name)
    const to = path.join(dest, e.name)
    if (e.isDirectory()) mirror(from, to)
    else if (e.isFile()) fs.copyFileSync(from, to)
  }
}

/** Runs a gate inside the sandbox and returns its exit code. */
function runGate(script) {
  try {
    execFileSync('node', [script], { cwd: SANDBOX, stdio: 'ignore', timeout: 120000 })
    return 0
  } catch (e) {
    return e.status ?? 1
  }
}

/** Applies a mutation, measures the gate, then puts the file back. */
function withViolation(relFile, mutate, script) {
  const full = path.join(SANDBOX, relFile)
  const original = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null
  try {
    mutate(full, original)
    return runGate(script)
  } finally {
    if (original === null) fs.rmSync(full, { force: true })
    else fs.writeFileSync(full, original)
  }
}

const append = (text) => (full, original) => fs.writeFileSync(full, `${original}\n${text}\n`)
const prepend = (text) => (full, original) => fs.writeFileSync(full, `${text}\n${original}`)

describe('the seven gates exit non-zero on the violation they claim to catch', () => {
  before(() => {
    SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-gates-'))
    mirror(REPO, SANDBOX)
  })

  after(() => {
    if (SANDBOX) fs.rmSync(SANDBOX, { recursive: true, force: true })
  })

  it('all seven are green on the untouched copy', () => {
    // Without this, a gate that fails for an unrelated reason would make every
    // case below pass for the wrong reason.
    const gates = [
      'scripts/multi-harness/cache-guard.mjs',
      'scripts/sdd-lifecycle/cache-prefix.mjs',
      'scripts/sdd-lifecycle/phase-handoffs.mjs',
      'scripts/multi-harness/reference-integrity.mjs',
      'scripts/multi-harness/validate-agent-routing.mjs',
      'scripts/scaffold/validate-srp.mjs',
      'scripts/scaffold/validate-test-globs.mjs',
    ]
    for (const g of gates) assert.equal(runGate(g), 0, `${g} ya falla sin violación inyectada`)
  })

  it('cache-guard catches a timestamp in a prompt prefix', () => {
    const code = withViolation(
      '.github/prompts/sdd-new.prompt.md',
      prepend('<!-- 2026-09-09T10:00:00 -->'),
      'scripts/multi-harness/cache-guard.mjs'
    )
    assert.notEqual(code, 0)
  })

  it('cache-prefix catches a buster in the x6 band', () => {
    const code = withViolation(
      '.github/skills/icm/SKILL.md',
      append('Generado: 2026-09-09T10:00:00'),
      'scripts/sdd-lifecycle/cache-prefix.mjs'
    )
    assert.notEqual(code, 0)
  })

  it('handoffs catches a producer that stops naming its artifact', () => {
    const code = withViolation(
      '.github/prompts/sdd-ff.prompt.md',
      (full, original) => fs.writeFileSync(full, original.replaceAll('design.md', 'blueprint.md')),
      'scripts/sdd-lifecycle/phase-handoffs.mjs'
    )
    assert.notEqual(code, 0)
  })

  it('reference-integrity catches a reference to a script that does not exist', () => {
    const code = withViolation(
      '.github/prompts/sdd-verify.prompt.md',
      append('Corré `node scripts/no-existe/fantasma.mjs`.'),
      'scripts/multi-harness/reference-integrity.mjs'
    )
    assert.notEqual(code, 0)
  })

  it('routing catches an agent missing from the registry', () => {
    const code = withViolation(
      '.github/instructions/agent-delegation.instructions.md',
      (full, original) => fs.writeFileSync(full, original.replaceAll('triage-specialist', 'triage-fantasma')),
      'scripts/multi-harness/validate-agent-routing.mjs'
    )
    assert.notEqual(code, 0)
  })

  it('srp catches a file over the 300 LOC limit', () => {
    const rel = 'scripts/sdd-lifecycle/gordo-de-prueba.mjs'
    const body = Array.from({ length: 400 }, (_, i) => `const x${i} = ${i}`).join('\n')
    fs.writeFileSync(path.join(SANDBOX, rel), body)
    fs.writeFileSync(path.join(SANDBOX, 'scaffold', rel), body)
    try {
      assert.notEqual(runGate('scripts/scaffold/validate-srp.mjs'), 0)
    } finally {
      fs.rmSync(path.join(SANDBOX, rel), { force: true })
      fs.rmSync(path.join(SANDBOX, 'scaffold', rel), { force: true })
    }
  })

  it('test-globs catches a glob that matches nothing', () => {
    const code = withViolation(
      'package.json',
      (full, original) =>
        fs.writeFileSync(full, original.replace('scripts/conf/*.test.mjs', 'scripts/inexistente/*.test.mjs')),
      'scripts/scaffold/validate-test-globs.mjs'
    )
    assert.notEqual(code, 0)
  })
})
