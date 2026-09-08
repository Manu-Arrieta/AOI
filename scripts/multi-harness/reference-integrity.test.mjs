import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  auditReferenceIntegrity,
  findDuplicateStepNumbers,
  ICM_MCP_TOOLS,
} from './reference-integrity.mjs'

/** Builds a throwaway repo whose only prose file contains `body`. */
function repoWith(body, relPath = '.github/prompts/sdd-probe.prompt.md') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-refs-'))
  for (const d of ['.github/prompts', '.github/agents', 'scripts/sdd-lifecycle']) {
    fs.mkdirSync(path.join(root, d), { recursive: true })
  }
  // A real command, a real agent and a real script so valid references resolve.
  fs.writeFileSync(path.join(root, '.github/prompts/sdd-probe.prompt.md'), '')
  fs.writeFileSync(path.join(root, '.github/agents/supervisor.agent.md'), '')
  fs.writeFileSync(path.join(root, 'scripts/sdd-lifecycle/real.mjs'), '')
  fs.mkdirSync(path.dirname(path.join(root, relPath)), { recursive: true })
  fs.writeFileSync(path.join(root, relPath), body)
  return root
}

const kinds = (audit) => audit.problems.map((p) => p.kind)
const refs = (audit) => audit.problems.map((p) => p.ref)

describe('reference-integrity linter', () => {
  it('catches a phantom MCP tool (the icm_memoir_add_observation class of bug)', () => {
    const root = repoWith('Persist it with `icm_memoir_add_observation(memoir: "x")`.\n')
    const audit = auditReferenceIntegrity(root)

    assert.equal(audit.status, 'FAILED')
    assert.ok(kinds(audit).includes('mcp-tool'))
    assert.ok(refs(audit).includes('icm_memoir_add_observation'))
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('accepts every MCP tool that actually exists on the ICM server', () => {
    const body = [...ICM_MCP_TOOLS].map((t) => `Call ${t} here.`).join('\n')
    const root = repoWith(body)
    const audit = auditReferenceIntegrity(root)

    assert.deepEqual(audit.problems.filter((p) => p.kind === 'mcp-tool'), [])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('catches a script path that does not exist', () => {
    const root = repoWith('Run `node scripts/sdd-lifecycle/ghost.mjs --exit-code`.\n')
    const audit = auditReferenceIntegrity(root)

    assert.equal(audit.status, 'FAILED')
    assert.ok(refs(audit).includes('scripts/sdd-lifecycle/ghost.mjs'))
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('accepts a script path that does exist', () => {
    const root = repoWith('Run `node scripts/sdd-lifecycle/real.mjs`.\n')
    assert.deepEqual(auditReferenceIntegrity(root).problems, [])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('catches an @agent with no agent file', () => {
    const root = repoWith('Hand off to the **@intent-framer** for calibration.\n')
    const audit = auditReferenceIntegrity(root)

    assert.equal(audit.status, 'FAILED')
    assert.ok(refs(audit).includes('@intent-framer'))
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('catches a slash command with no prompt file', () => {
    const root = repoWith('Then run `/sdd-teleport` to finish.\n')
    const audit = auditReferenceIntegrity(root)

    assert.equal(audit.status, 'FAILED')
    assert.ok(refs(audit).includes('/sdd-teleport'))
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('does not mistake sentence punctuation for part of a command name', () => {
    // Regression: "/sdd-probe." at the end of a sentence is a valid reference.
    const root = repoWith('Service Discovery runs during /sdd-probe. This is mandatory.\n')
    assert.deepEqual(auditReferenceIntegrity(root).problems, [])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('does not mistake an email-like handle for an agent', () => {
    const root = repoWith('Clone with `git@github.com:owner/repo.git`.\n')
    assert.deepEqual(auditReferenceIntegrity(root).problems, [])
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('narrative surfaces (docs, wiki)', () => {
  it('still catches a script path that does not exist', () => {
    const root = repoWith('Run `node scripts/sdd-lifecycle/ghost.mjs`.\n', 'docs/guide.md')
    const audit = auditReferenceIntegrity(root)

    assert.equal(audit.status, 'FAILED')
    assert.ok(refs(audit).includes('scripts/sdd-lifecycle/ghost.mjs'))
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('tolerates illustrative shorthand that narrative prose legitimately uses', () => {
    // @backend is shorthand for @backend-developer, @scope/pkg is an npm scope,
    // and icm_store is the MCP gateway's compressed name — none resolve to a
    // file, and flagging them would train people to ignore this linter.
    const body = 'Micro-agents (@backend/@frontend) use @atlassian-labs/tools and icm_store.\n'
    const root = repoWith(body, 'wiki/05-agents.md')
    assert.deepEqual(auditReferenceIntegrity(root).problems, [])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('does NOT tolerate that same shorthand inside executable prose', () => {
    const body = 'Micro-agents (@backend/@frontend) use icm_store.\n'
    const root = repoWith(body, '.github/agents/probe.agent.md')
    const audit = auditReferenceIntegrity(root)

    assert.equal(audit.status, 'FAILED')
    assert.ok(refs(audit).includes('@backend'))
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('findDuplicateStepNumbers', () => {
  it('catches the duplicate ordinal left behind when a step is inserted', () => {
    const issues = findDuplicateStepNumbers('1. one\n2. two\n3. three\n4. four\n5. five\n5. dup\n6. six\n')
    assert.equal(issues.length, 1)
    assert.match(issues[0], /step "5\." appears 2 times/)
  })

  it('allows lazy Markdown numbering, where every item is written as 1.', () => {
    assert.deepEqual(findDuplicateStepNumbers('1. one\n1. two\n1. three\n'), [])
  })

  it('treats a heading between lists as a list boundary', () => {
    const text = '1. a\n2. b\n\n## Another section\n\n1. a\n2. b\n'
    assert.deepEqual(findDuplicateStepNumbers(text), [])
  })
})
