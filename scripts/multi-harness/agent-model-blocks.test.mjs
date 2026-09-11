/**
 * scripts/multi-harness/agent-model-blocks.test.mjs
 *
 * The \`## Model Requirement\` block is paid on every delegation, and the
 * supervisor pays it in all six phases, so what it may and may not contain is
 * a token-economy decision as much as a correctness one.
 *
 * Split out of lifecycle-wiring.test.mjs when that file crossed the 300 LOC of
 * Invariant 5.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

describe('per-agent model blocks stay compressed', () => {
  const agents = fs
    .readdirSync(path.join(ROOT, '.github/agents'))
    .filter((f) => f.endsWith('.agent.md'))

  it('every agent still states its model and fallback where the operator reads it', () => {
    // Model and fallback are per-agent facts and stay per-agent. The picker
    // cue is not: it was the same sentence in all 27, and the file it pointed
    // at is loaded in every phase anyway, so 27 copies bought nothing.
    for (const f of agents) {
      const text = read(`.github/agents/${f}`)
      assert.match(text, /## Model Requirement/, `${f} lost its model block`)
      assert.match(text, /\*\*Model\*\*:/, `${f} no longer states its model`)
      assert.match(text, /\*\*Fallback\*\*:/, `${f} no longer states its fallback`)
    }
  })

  it('states the picker cue exactly once, in the registry every phase loads', () => {
    // Removing it from the agents only works while it survives somewhere the
    // operator reads. Deleting it outright would be a real capability loss.
    const registry = read('.github/instructions/agent-delegation.instructions.md')
    assert.match(registry, /picker de Copilot/, 'el registro perdió el aviso del picker')

    const stragglers = agents.filter((f) => /picker de Copilot/.test(read(`.github/agents/${f}`)))
    assert.deepEqual(stragglers, [], 'el aviso volvió a duplicarse en los agentes')
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
