import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  agentsIn,
  auditContextBudget,
  expandBraces,
  fileTokens,
  instructionsFor,
  matchesApplyTo,
  phaseContextCost,
  speckitIn,
} from './context-budget.mjs'

/** Builds a throwaway workspace shaped like an AOI install. */
function workspace(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-budget-'))
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, body)
  }
  return root
}

describe('expandBraces', () => {
  it('expands a single alternation', () => {
    assert.deepEqual(expandBraces('.github/{agents,prompts}/**'), ['.github/agents/**', '.github/prompts/**'])
  })

  it('expands nested and multiple alternations', () => {
    assert.deepEqual(expandBraces('**/*.{ts,js}'), ['**/*.ts', '**/*.js'])
  })

  it('leaves a brace-free pattern untouched', () => {
    assert.deepEqual(expandBraces('**'), ['**'])
  })
})

describe('matchesApplyTo', () => {
  it('treats ** as matching every path, which is why it is the expensive one', () => {
    assert.equal(matchesApplyTo('**', '.github/prompts/sdd-verify.prompt.md'), true)
    assert.equal(matchesApplyTo('**', 'deep/nested/file.ts'), true)
  })

  it('matches a prompt against the agents/prompts glob used by the routing tables', () => {
    const applyTo = '.github/{agents,prompts}/**,**/*.agent.md,**/*.prompt.md'
    assert.equal(matchesApplyTo(applyTo, '.github/prompts/sdd-ff.prompt.md'), true)
    assert.equal(matchesApplyTo(applyTo, 'src/index.ts'), false)
  })

  it('matches code extensions only for code files', () => {
    const applyTo = '**/*.{ts,js,vue}'
    assert.equal(matchesApplyTo(applyTo, 'server/utils/token-budget.ts'), true)
    assert.equal(matchesApplyTo(applyTo, '.github/prompts/sdd-apply.prompt.md'), false)
  })

  it('lets **/ match a file at the root, not only nested ones', () => {
    assert.equal(matchesApplyTo('**/*.md', 'README.md'), true)
  })
})

describe('reference extraction', () => {
  it('separates delegated agents from spec-kit commands', () => {
    const text = 'Hand off to @solution-architect, then @supervisor runs /speckit.plan and /speckit.tasks.'

    assert.deepEqual(agentsIn(text), ['solution-architect', 'supervisor'])
    assert.deepEqual(speckitIn(text), ['speckit.plan', 'speckit.tasks'])
  })

  it('never counts a spec-kit agent twice as a plain agent', () => {
    assert.deepEqual(agentsIn('@speckit.checklist runs here'), [])
  })
})

describe('phaseContextCost', () => {
  it('sums prompt, delegated agents, spec-kit commands and matching instructions', () => {
    const root = workspace({
      '.github/prompts/p.prompt.md': 'x'.repeat(400) + ' @supervisor /speckit.plan',
      '.github/agents/supervisor.agent.md': 'y'.repeat(200),
      '.github/agents/speckit.plan.agent.md': 'z'.repeat(120),
      '.github/instructions/always.instructions.md': 'applyTo: "**"\n' + 'a'.repeat(80),
      '.github/instructions/code-only.instructions.md': 'applyTo: "**/*.ts"\n' + 'b'.repeat(4000),
    })

    const cost = phaseContextCost(root, '.github/prompts/p.prompt.md')

    assert.equal(cost.agents, fileTokens(path.join(root, '.github/agents/supervisor.agent.md')))
    assert.equal(cost.speckit, fileTokens(path.join(root, '.github/agents/speckit.plan.agent.md')))
    // The code-only instruction must NOT be charged to a prompt.
    assert.deepEqual(cost.detail.instructions, ['.github/instructions/always.instructions.md'])
    assert.equal(cost.total, cost.prompt + cost.agents + cost.speckit + cost.instructions)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('charges nothing for an agent the prompt names but the workspace lacks', () => {
    const root = workspace({ '.github/prompts/p.prompt.md': '@ghost-agent' })

    assert.equal(phaseContextCost(root, '.github/prompts/p.prompt.md').agents, 0)
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('instructionsFor', () => {
  it('ignores an instruction file with no applyTo, which the harness never injects', () => {
    const root = workspace({ '.github/instructions/loose.instructions.md': 'no frontmatter here' })

    assert.deepEqual(instructionsFor(root, 'anything.md'), [])
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('auditContextBudget', () => {
  it('skips phases whose prompt is absent instead of inventing a cost', () => {
    const root = workspace({ '.github/prompts/sdd-frame.prompt.md': 'hello' })
    const report = auditContextBudget(root)

    assert.equal(report.rows.length, 1)
    assert.equal(report.rows[0].phase, 'Phase_0_Frame')
    assert.equal(report.total, report.rows[0].total)
    fs.rmSync(root, { recursive: true, force: true })
  })
})
