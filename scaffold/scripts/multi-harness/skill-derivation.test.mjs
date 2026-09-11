/**
 * scripts/multi-harness/skill-derivation.test.mjs
 *
 * The mechanism that lets a skill in the ×6 band shrink without leaving a
 * harness behind — and which nothing verified until now, including for the
 * RTK skill that already shipped shrunk.
 *
 * The problem it solves: `.github/instructions/*.md` with `applyTo: "**"` are
 * injected into every phase, so a skill restating one pays for the same words
 * six times per cycle. But `compile-rules` maps the antigravity harness to
 * `.agents/` and NOT to `.github/instructions/`, so for that harness the
 * skill is the only place the doctrine appears. Deleting the restatement
 * would have made the cycle cheaper and antigravity ignorant.
 *
 * `deriveSkillFromInstruction` breaks the trade-off: the `.github` skill
 * shrinks to its trigger plus essentials, and antigravity's copy is BUILT
 * from the instruction — so it gets MORE than the mirrored version carried,
 * not less.
 *
 * The invariant below is the one that matters. A skill that announces its
 * canonical text lives in an instruction MUST be registered for derivation.
 * Shrink one without registering it and antigravity silently loses the
 * content, with every gate still green.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { deriveSkillFromInstruction, SKILL_FROM_INSTRUCTION, SKILL_TRIGGERS } from './protocol-source.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

describe('a shrunk skill and its derivation are registered together', () => {
  const skillsDir = path.join(ROOT, '.github/skills')
  const skills = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)

  it('finds the skills, so the gate is not vacuous', () => {
    assert.ok(skills.length >= 5, `sólo ${skills.length} skills`)
  })

  for (const name of skills) {
    const body = read(`.github/skills/${name}/SKILL.md`)
    // DECLARED with a marker, never inferred from prose — the same rule the
    // phase-reference scanner had to learn. A first version matched any
    // mention of an instruction path and immediately flagged
    // spec-kit-integration, which merely cites one for a cross-reference
    // ("See … for the full table"). A detector that cannot tell delegation
    // from citation guards nothing.
    const declared = body.match(/<!-- canonical-instruction: ([a-z-]+\.instructions\.md) -->/)
    if (!declared) continue

    it(`${name} delegates to an instruction, so it is registered for derivation`, () => {
      assert.ok(
        SKILL_FROM_INSTRUCTION[name],
        `${name} dice que su texto canónico vive en una instruction pero no está en ` +
          'SKILL_FROM_INSTRUCTION: antigravity recibiría la versión corta y perdería el resto'
      )
    })

    it(`${name} names the instruction it is actually derived from`, () => {
      // The pointer in the prose and the registration must agree, or the
      // skill sends a reader to one file while the build derives another.
      assert.equal(SKILL_FROM_INSTRUCTION[name], declared[1])
    })
  }
})

describe('deriveSkillFromInstruction', () => {
  it('returns null for a skill with no canonical instruction, so the build mirrors it', () => {
    assert.equal(deriveSkillFromInstruction(ROOT, 'sdd-lifecycle'), null)
    assert.equal(deriveSkillFromInstruction(ROOT, 'inventada'), null)
  })

  for (const [name, source] of Object.entries(SKILL_FROM_INSTRUCTION)) {
    it(`derives ${name} from the instruction's body`, () => {
      const derived = deriveSkillFromInstruction(ROOT, name)
      assert.ok(derived, `${name} no derivó`)

      const instruction = read(`.github/instructions/${source}`)
      const instructionBody = instruction.replace(/^---\n[\s\S]*?\n---\n/, '').trim()
      assert.ok(derived.includes(instructionBody), `${name} no lleva el cuerpo de ${source}`)
    })

    it(`gives ${name} a skill front matter, not the instruction's`, () => {
      // `applyTo` means nothing to a skill loader; `description` is what makes
      // the harness decide to load it at all.
      const derived = deriveSkillFromInstruction(ROOT, name)
      assert.match(derived, new RegExp(`^---\\nname: ${name}\\n`))
      assert.match(derived, /^description: .+$/m)
      assert.doesNotMatch(derived.split('---')[1] ?? '', /applyTo/)
      assert.ok(SKILL_TRIGGERS[name], `${name} sin trigger declarado`)
    })

    it(`${name} carries MORE than the shrunk skill it replaces`, () => {
      // The whole point: antigravity must not pay for the cut. If the derived
      // copy were smaller than the .github one, the harness that cannot read
      // instructions would be the one losing content.
      const derived = deriveSkillFromInstruction(ROOT, name)
      const shrunk = read(`.github/skills/${name}/SKILL.md`)
      assert.ok(
        derived.length > shrunk.length,
        `la copia derivada de ${name} es más chica que la recortada: antigravity perdió contenido`
      )
    })
  }
})
