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

describe('per-agent model blocks stay compressed', () => {
  const agents = fs
    .readdirSync(path.join(ROOT, '.github/agents'))
    .filter((f) => f.endsWith('.agent.md'))

  it('every agent still states its model and fallback where the operator reads it', () => {
    for (const f of agents) {
      const text = read(`.github/agents/${f}`)
      assert.match(text, /## Model Requirement/, `${f} lost its model block`)
      assert.match(text, /\*\*Model\*\*:/, `${f} no longer states its model`)
      assert.match(text, /\*\*Fallback\*\*:/, `${f} no longer states its fallback`)
      assert.match(text, /picker de Copilot/, `${f} lost the operator cue about the model picker`)
    }
  })

  it('does not grow the justification prose back, which lives in the registry', () => {
    // 27 agents × a paragraph of rationale is paid on every delegation and
    // says nothing the operator acts on at that moment.
    const bloated = agents.filter((f) => /Justificación/.test(read(`.github/agents/${f}`)))
    assert.deepEqual(bloated, [], 'model rationale prose came back into the agent files')
  })

  it('keeps the whole block small, since it is paid on every delegation', () => {
    for (const f of agents) {
      const block = /## Model Requirement\n[\s\S]*?(?=\n## )/.exec(read(`.github/agents/${f}`))
      if (!block) continue
      const tokens = Math.round(block[0].length / 4)
      assert.ok(tokens <= 110, `${f} model block grew to ${tokens} tokens`)
    }
  })
})
