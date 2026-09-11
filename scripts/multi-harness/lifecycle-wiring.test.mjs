/**
 * scripts/multi-harness/lifecycle-wiring.test.mjs
 *
 * Pins decisions about WHERE things run in the SDD lifecycle, and about the
 * shape of surfaces that are paid on every delegation.
 *
 * These are choices no other gate can defend. Scaffold parity proves root and
 * mirror agree; the reference linter proves every command resolves; the
 * context budget measures what a phase costs. None of them notices if a step
 * migrates to a phase where its output is useless, or if a block that was
 * deliberately compressed grows back — both regress silently, and both cost
 * either tokens or quality without ever failing anything.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { speckitIn } from '../sdd-lifecycle/context-budget.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

describe('spec checklist runs where its findings are still actionable', () => {
  it('is invoked during /sdd-ff, while the spec is being written', () => {
    // It validates the QUALITY OF THE REQUIREMENTS PROSE — its own file says so
    // in capitals — not the implementation. Here a bad requirement costs one
    // line to fix.
    assert.match(read('.github/prompts/sdd-ff.prompt.md'), /\/speckit\.checklist/)
  })

  it('is NOT invoked during /sdd-verify, where the code already exists', () => {
    // By then the spec has been specified, planned, implemented and tested
    // against. Discovering the requirement was ambiguous is 5k tokens spent at
    // the moment the finding is most expensive to act on.
    assert.doesNotMatch(
      read('.github/prompts/sdd-verify.prompt.md'),
      /\/speckit\.checklist/,
      'the spec checklist moved back into the implementation-verification phase'
    )
  })

  it('fires only when the contract is non-trivial, on signals that cost no inference', () => {
    // It is the single most expensive artifact in the cycle. A one-invariant
    // contract that came out unambiguous has no prose worth auditing, so
    // running it there spends without finding anything. Both gating signals
    // already exist for free: whether /speckit.clarify fired, and the O(1)
    // count of Never Rules in ICM.
    // Asserted through the classifier the budget itself uses, not by grepping
    // for "if": the line legitimately contains other conditionals, and a guard
    // that disagrees with the measuring instrument guards nothing.
    const entry = speckitIn(read('.github/prompts/sdd-ff.prompt.md')).find((s) => s.command === 'speckit.checklist')

    assert.ok(entry, 'the spec checklist is not invoked at all')
    assert.equal(entry.conditional, true, 'the spec checklist became unconditional again — it is the priciest step in the cycle')

    const line = read('.github/prompts/sdd-ff.prompt.md')
      .split('\n')
      .find((l) => l.includes('/speckit.checklist'))
    assert.match(line, /clarify|Never Rule/, 'it is gated on something other than the two free signals')
  })

  it('is still reachable somewhere, so the requirements axis is not left uncovered', () => {
    // No deterministic gate validates requirements prose. If this disappears
    // entirely, that axis has nothing at all watching it.
    const prompts = fs
      .readdirSync(path.join(ROOT, '.github/prompts'))
      .filter((f) => f.startsWith('sdd-'))
      .map((f) => read(`.github/prompts/${f}`))
    assert.ok(
      prompts.some((p) => p.includes('/speckit.checklist')),
      'no SDD phase validates requirements quality any more'
    )
  })
})

describe('the [conditional] marker cannot be used to invent savings', () => {
  const prompts = fs
    .readdirSync(path.join(ROOT, '.github/prompts'))
    .filter((f) => f.startsWith('sdd-'))
    .map((f) => ({ file: f, lines: read(`.github/prompts/${f}`).split('\n') }))

  const CONDITION = /\b(?:if|when|unless|only|cuando|si)\b/i

  it('every marked line actually states the condition it claims', () => {
    // The marker takes a step out of the floor, which is exactly how a saving
    // is claimed. Marking something that always runs would report a reduction
    // that does not exist — the most dangerous direction of this convention,
    // because the number moves and nothing else does.
    const unjustified = []
    for (const { file, lines } of prompts) {
      lines.forEach((l, i) => {
        if (l.includes('[conditional]') && !CONDITION.test(l)) unjustified.push(`${file}:${i + 1}`)
      })
    }
    assert.deepEqual(unjustified, [], 'a [conditional] marker with no stated condition is an unearned discount')
  })

  it('every [one-of] line actually enumerates a choice', () => {
    // [one-of] pulls the cheapest candidate into the floor, so unlike
    // [conditional] it cannot be used to claim a saving. It can still mislead:
    // a single name behind it describes a choice that does not exist.
    const CHARGED_G = /(?:^|[^\w.@])@(?!speckit\.)[a-z][a-z0-9.-]*[a-z0-9]|\/speckit\.[a-z]/g
    const bogus = []
    for (const { file, lines } of prompts) {
      lines.forEach((l, i) => {
        if (!l.includes('[one-of]')) return
        if ([...l.matchAll(CHARGED_G)].length < 2) bogus.push(`${file}:${i + 1}`)
      })
    }
    assert.deepEqual(bogus, [], 'a [one-of] marker naming fewer than two candidates describes no choice')
  })

  it('a step whose line opens with a condition carries the marker', () => {
    // The safe direction: forgetting the marker overstates the floor rather
    // than understating it. Still worth catching — an unmarked branch makes
    // the phase look more expensive than it is and hides real headroom.
    // Una condición encabeza una viñeta, un paso numerado, o la segunda celda
    // de una tabla de decisión — donde vive en el Intent Gate de /sdd-frame.
    const LEADS_WITH_CONDITION =
      /^\s*(?:[-*]|\d+\.)?\s*(?:\*\*)?(?:If|When|Unless|Si|Cuando)\b|^\s*\|[^|]*\|\s*(?:\*\*)?(?:\[conditional\]\*\*\s*)?(?:If|When|Unless|Si|Cuando)\b/
    // Restricted to exactly what the budget charges — an @agent delegation or a
    // /speckit command. A looser pattern flagged file paths, next-phase
    // suggestions like `/sdd-apply`, and prose naming whose output a file is.
    const CHARGED = /(?:^|[^\w.@])@(?!speckit\.)[a-z][a-z0-9.-]*[a-z0-9]|\/speckit\.[a-z]/
    const unmarked = []
    for (const { file, lines } of prompts) {
      const steps = lines.filter((l) => !/^\s*>/.test(l))
      for (const name of new Set(steps.flatMap((l) => [...l.matchAll(new RegExp(CHARGED, 'g'))].map((m) => m[0].replace(/^[^@/]+/, '').trim())))) {
        const mentions = steps.filter((l) => l.includes(name))
        // Only worth flagging when EVERY mention is a conditional branch: if the
        // same agent is also delegated outright somewhere, it belongs in the
        // floor regardless and marking this line would change nothing.
        const allConditional = mentions.every((l) => LEADS_WITH_CONDITION.test(l))
        const anyMarked = mentions.some((l) => l.includes('[conditional]'))
        if (allConditional && !anyMarked) unmarked.push(`${file} → ${name}`)
      }
    }
    assert.deepEqual(unmarked, [], 'a conditional invocation is being charged to the floor of every run')
  })
})

describe('the supervisor routes phases without re-specifying them', () => {
  const supervisor = read('.github/agents/supervisor.agent.md')

  it('does not carry a step list for each command', () => {
    // supervisor.agent.md is loaded in all six phases, so a block describing
    // what to do in all seven commands made every phase pay for the other six
    // — and the steps were already in the prompt the harness had just loaded.
    const perCommandSections = supervisor.split('\n').filter((l) => /^### `\/(sdd|sandbox)-/.test(l))
    assert.deepEqual(perCommandSections, [], 'per-command step lists came back into the supervisor')
  })

  it('still owns the gate chain, which is its actual job', () => {
    // Routing and gates are the supervisor's responsibility and live nowhere
    // else in one place. Compressing must not take those with it.
    for (const gate of ['Intent Gate', 'Flexible Archive Gate', 'proposal.md', 'implementation-plan.md']) {
      assert.ok(supervisor.includes(gate), `the supervisor lost the ${gate} handoff`)
    }
  })

  it('stays within a budget, since it is the priciest file in the system', () => {
    const tokens = Math.round(supervisor.length / 4)
    assert.ok(tokens <= 2800, `supervisor.agent.md grew to ${tokens} tokens, and it loads in all six phases`)
  })

  it('keeps the search rule that used to live only in the supervisor', () => {
    // Compressing a file is where unique content dies. This rule existed in no
    // prompt at all, so dropping the block would have deleted it outright.
    assert.match(
      read('.github/prompts/sdd-new.prompt.md'),
      /VS Code/,
      'the Service Discovery search rule was lost in the compression'
    )
  })
})

describe('the supervisor can still route every phase to its agent', () => {
  const supervisor = read('.github/agents/supervisor.agent.md')

  // Compressing the supervisor removed a block that also restated routing. It
  // survived because three other sections carry it, but nothing verified that
  // — the risk was real and invisible.
  const ROUTING = [
    ['Explore', 'functional-analyst'],
    ['Specify', 'functional-analyst'],
    ['Plan', 'solution-architect'],
    ['Tasks', 'solution-architect'],
    ['Implement', 'frontend-developer'],
    ['Verify', 'integration-specialist'],
    ['Archive', 'documentation-analyst'],
  ]

  it('names the responsible agent for every phase of the lifecycle', () => {
    const table = supervisor.slice(
      supervisor.indexOf('## SDD Lifecycle — Phase Routing'),
      supervisor.indexOf('## Hub-and-Spoke')
    )
    for (const [phase, agent] of ROUTING) {
      const row = table.split('\n').find((l) => l.includes(`**${phase}**`))
      assert.ok(row, `the routing table lost the ${phase} phase`)
      assert.ok(row.includes(agent), `${phase} no longer routes to @${agent}`)
    }
  })

  it('keeps every role reachable by its handle', () => {
    // Format-agnostic on purpose. The previous assertion required the handle
    // inside backticks, which was the shape of a separate "Agent Roster"
    // table — a transposition of the routing table above it, restating the
    // same eight agents. Folding it away cut 1.098 tokens per cycle from the
    // x6 band; nothing consumes the backticked form, and reference-integrity
    // matches either way.
    for (const [, agent] of ROUTING) {
      assert.match(supervisor, new RegExp(`@${agent}\\b`), `the supervisor lost @${agent}`)
    }
  })

  it('keeps the two things the roster carried and nothing else did', () => {
    // This is what made the fold safe to do and unsafe to do carelessly. The
    // roster was the ONLY place that named @project-expert's purpose and the
    // ONLY place that marked backend and devops as optional — and no test
    // covered either, so a compression would have dropped them in silence.
    // Both now live in the routing table, where they describe a phase rather
    // than a second listing of the cast.
    assert.match(supervisor, /@project-expert/, 'lost the transversal domain-expert agent')
    assert.match(supervisor, /Domain Q&A/, "lost @project-expert's purpose")
    // Per agent, not per row: both sit on the same table row, so looking for
    // the word anywhere in the line let one of them lose its marker while the
    // other's kept the assertion green. Caught by a negative control.
    for (const agent of ['backend-developer', 'devops-engineer']) {
      assert.match(
        supervisor,
        new RegExp(`@${agent} \\(optional\\)`),
        `@${agent} is no longer marked optional`
      )
    }
  })

  it('keeps the hub-and-spoke mechanics, which live nowhere else', () => {
    // What to recall before delegating and what to persist after are the
    // supervisor's own protocol — no phase prompt restates them.
    for (const step of ['Before routing to ANY agent', 'After receiving deliverable', 'sanitize-subagent-payload', 'Project Standards']) {
      assert.ok(supervisor.includes(step), `the supervisor lost its hub-and-spoke step: ${step}`)
    }
  })
})

describe('entry guidance loads where the entry decision is made', () => {
  const general = read('.github/skills/sdd-lifecycle/SKILL.md')
  const entry = read('.github/skills/sdd-entry/SKILL.md')

  it('the full comparison lives in the entry skill, not in the general one', () => {
    // Choosing between /sdd-frame and /sdd-new is an entry-time question. It
    // was loaded in all six phases, including the four where the decision was
    // taken two steps earlier.
    assert.match(entry, /Pre-Flight.*Explore|sdd-frame.*sdd-new/s, 'the entry skill lost the comparison')
    assert.doesNotMatch(general, /### Decision Guide: Which Command to Start With/, 'the entry guide came back into the always-loaded skill')
  })

  it('the general skill still says which command opens the cycle', () => {
    // Splitting must not leave an agent with no idea where to start. A compact
    // rule stays; only the detail moved.
    assert.match(general, /sdd-frame/, 'the general skill no longer mentions the entry commands')
    assert.match(general, /sdd-entry/, 'nothing points at where the detail went')
  })

  it('its trigger names both entry commands, since that is how it loads', () => {
    const description = /^description:.*$/m.exec(entry)?.[0] ?? ''
    assert.match(description, /sdd-frame/, 'the trigger omits /sdd-frame')
    assert.match(description, /sdd-new/, 'the trigger omits /sdd-new')
  })
})

describe('triage detail lives with the triage agent, not in every phase', () => {
  const skill = read('.github/skills/sdd-lifecycle/SKILL.md')
  const triage = read('.github/agents/triage-specialist.agent.md')

  it('the always-loaded skill keeps only the routing rule', () => {
    // The three-scenario table was duplicated: the skill carried it in all six
    // phases while @triage-specialist carries the diagnosis it actually needs,
    // loaded exactly when the agent is delegated to.
    assert.match(skill, /triage-specialist/, 'the skill no longer says where to route a defect')
    assert.match(skill, /sdd-frame/, 'the skill no longer says where an invariant gap goes')
    assert.doesNotMatch(skill, /\| \*\*1\. Technical Bug\*\*/, 'the scenario table came back into the always-loaded skill')
  })

  it('the triage agent still carries the full diagnosis', () => {
    // Cutting the skill is only safe while this remains true.
    for (const marker of ['Type A', 'Type B', 'Type C']) {
      assert.ok(triage.includes(marker), `the triage agent lost its ${marker} classification`)
    }
  })
})
