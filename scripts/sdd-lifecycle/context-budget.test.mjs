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

    assert.deepEqual(agentsIn(text).map((a) => a.name), ['solution-architect', 'supervisor'])
    assert.deepEqual(speckitIn(text).map((s) => s.command), ['speckit.plan', 'speckit.tasks'])
  })

  it('flags a command whose invocation line makes it conditional', () => {
    // Charging a conditional step to every run overstates the phase and, worse,
    // makes "turn this step conditional" show up as zero improvement.
    const text = [
      '2. Runs `/speckit.specify` to generate the formal spec',
      '4. **[conditional]** Runs `/speckit.clarify` if ambiguities are detected',
    ].join('\n')

    assert.deepEqual(speckitIn(text), [
      { command: 'speckit.clarify', conditional: true },
      { command: 'speckit.specify', conditional: false },
    ])
  })

  it('treats a command as unconditional when any line invokes it outright', () => {
    // Mentioned once under a condition and once plainly: it is paid every run.
    const text = 'Runs `/speckit.plan` **[conditional]** here.\nAlways runs `/speckit.plan` afterwards.'

    assert.deepEqual(speckitIn(text), [{ command: 'speckit.plan', conditional: false }])
  })

  it('never counts a spec-kit agent twice as a plain agent', () => {
    assert.deepEqual(agentsIn('@speckit.checklist runs here'), [])
  })

  it('flags a conditional agent delegation the same way as a command', () => {
    // @triage-specialist is delegated only when the input turns out to be a
    // defect, a branch that ends the SDD path. Charging it to every run
    // overstated Phase 0 by its full weight.
    const text = '- **[conditional]** If it is a bug: route to `@triage-specialist`.\n- Always hand off to @supervisor.'

    assert.deepEqual(agentsIn(text), [
      { name: 'supervisor', conditional: false },
      { name: 'triage-specialist', conditional: true },
    ])
  })

  it('ignores commands named inside an explanatory blockquote', () => {
    // A note is not a step. Counting it as one dragged the command back into
    // the floor, because notes carry no marker — the exact bug that made a
    // conditional /speckit.clarify read as unconditional.
    const text = [
      '4. **[conditional]** Runs `/speckit.clarify` if ambiguities are detected',
      '   > **Why conditional.** It only pays when `/speckit.clarify` already fired.',
    ].join('\n')

    assert.deepEqual(speckitIn(text), [{ command: 'speckit.clarify', conditional: true }])
  })

  it('does not infer conditionality from English prose, only from the marker', () => {
    // An earlier version guessed from words like "if". It could not tell an
    // invocation that is itself conditional from a line that happens to
    // mention a condition, so a line reading "runs X always, if Y already
    // ran" was silently scored as conditional and the floor came out too low.
    const text = 'Runs `/speckit.plan` always, even if the spec is trivial.'

    assert.deepEqual(speckitIn(text), [{ command: 'speckit.plan', conditional: false }])
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
    assert.equal(cost.conditional, 0)
    assert.equal(cost.floor, cost.total)
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

describe('one-of candidate sets', () => {
  it('charges the cheapest candidate to the floor and the rest to the margin', () => {
    // /sdd-apply names three implementation agents and picks whichever the task
    // needs. Charging all three says every cycle runs all three; marking them
    // merely conditional says a cycle may run none, and a floor with no
    // developer at all is a number no real cycle can reach.
    const root = workspace({
      '.github/prompts/p.prompt.md': '**[one-of]** Delegate to `@frontend-developer`, `@backend-developer` or `@devops-engineer`.',
      '.github/agents/frontend-developer.agent.md': 'f'.repeat(1600),
      '.github/agents/backend-developer.agent.md': 'b'.repeat(1200),
      '.github/agents/devops-engineer.agent.md': 'd'.repeat(800),
    })

    const cost = phaseContextCost(root, '.github/prompts/p.prompt.md')
    assert.equal(cost.agents, 200, 'the floor takes the cheapest candidate, 800 chars')
    assert.equal(cost.conditional, 700, 'the other two stay in the conditional margin')
    assert.deepEqual(cost.detail.oneOf, [['backend-developer', 'devops-engineer', 'frontend-developer']])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('does not treat a lone marked reference as a candidate set', () => {
    // One name behind [one-of] is just a conditional step; there is nothing to
    // choose between, so nothing may be pulled into the floor.
    const root = workspace({
      '.github/prompts/p.prompt.md': '**[one-of]** Delegate to `@backend-developer`.',
      '.github/agents/backend-developer.agent.md': 'b'.repeat(1200),
    })

    const cost = phaseContextCost(root, '.github/prompts/p.prompt.md')
    assert.equal(cost.agents, 0)
    assert.equal(cost.conditional, 300)
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('floor versus ceiling', () => {
  it('keeps a conditional command out of the floor but inside the ceiling', () => {
    const root = workspace({
      '.github/prompts/p.prompt.md': 'Runs `/speckit.plan`.\n**[conditional]** Runs `/speckit.clarify` if ambiguities.',
      '.github/agents/speckit.plan.agent.md': 'p'.repeat(400),
      '.github/agents/speckit.clarify.agent.md': 'c'.repeat(800),
    })

    const cost = phaseContextCost(root, '.github/prompts/p.prompt.md')
    assert.equal(cost.speckit, 100)
    assert.equal(cost.conditional, 200)
    assert.equal(cost.total - cost.floor, 200, 'the ceiling must exceed the floor by exactly the conditional cost')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('makes turning a step conditional visible as a drop in the floor', () => {
    // The regression this whole change exists to prevent: an optimisation that
    // the measuring instrument cannot see is an optimisation nobody can prove.
    const files = {
      '.github/agents/speckit.checklist.agent.md': 'x'.repeat(2000),
    }
    const before = workspace({ ...files, '.github/prompts/p.prompt.md': 'Runs `/speckit.checklist` to validate.' })
    const after = workspace({ ...files, '.github/prompts/p.prompt.md': '**[conditional]** Runs `/speckit.checklist`.' })

    const b = phaseContextCost(before, '.github/prompts/p.prompt.md')
    const a = phaseContextCost(after, '.github/prompts/p.prompt.md')

    assert.ok(a.floor < b.floor, 'making a step conditional must lower the floor')
    // Compared on the spec-kit split rather than the raw floor: the two prompts
    // differ in wording, so their own length moves the floor by a few tokens.
    assert.deepEqual([b.speckit, b.conditional], [500, 0], 'before: charged to every run')
    assert.deepEqual([a.speckit, a.conditional], [0, 500], 'after: charged only when it fires')
    assert.equal(a.total - a.floor, 500)
    fs.rmSync(before, { recursive: true, force: true })
    fs.rmSync(after, { recursive: true, force: true })
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
