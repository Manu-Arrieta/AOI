import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { skillsFor, SKILL_SCOPE } from './instruction-scope.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** Builds a throwaway workspace with skills of exact sizes. */
function workspace(skills) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-skills-'))
  for (const [name, chars] of Object.entries(skills)) {
    const dir = path.join(root, '.github/skills', name)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'SKILL.md'), 'x'.repeat(chars))
  }
  return root
}

describe('skillsFor', () => {
  it('loads the skills whose declared trigger covers the phase', () => {
    const root = workspace({ 'sdd-lifecycle': 400, icm: 200, 'memory-governance': 4000 })
    const loaded = skillsFor(root, 'Phase_0_Frame')

    assert.deepEqual(loaded.map((s) => s.name), ['icm', 'sdd-lifecycle'])
    assert.equal(loaded.reduce((n, s) => n + s.tokens, 0), 150)
  })

  it('adds the spec-kit skill only to the phases that generate artifacts', () => {
    const root = workspace({ 'spec-kit-integration': 400 })

    assert.equal(skillsFor(root, 'Phase_2_FF').length, 1)
    assert.equal(skillsFor(root, 'Phase_3_Apply').length, 1)
    assert.equal(skillsFor(root, 'Phase_0_Frame').length, 0)
    assert.equal(skillsFor(root, 'Phase_5_Archive').length, 0)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('charges an unmapped skill rather than ignoring it', () => {
    // A silent omission is exactly how the entire skills surface went
    // unmeasured. When in doubt the budget must overstate, never understate:
    // an inflated cost gets questioned, a missing one never does.
    const root = workspace({ 'brand-new-skill': 800 })
    const loaded = skillsFor(root, 'Phase_0_Frame')

    assert.deepEqual(loaded.map((s) => s.name), ['brand-new-skill'])
    assert.equal(loaded[0].mapped, false, 'it must be reported as unmapped so the omission is visible')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('skips a directory with no SKILL.md', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-skills-'))
    fs.mkdirSync(path.join(root, '.github/skills/empty'), { recursive: true })

    assert.deepEqual(skillsFor(root, 'Phase_0_Frame'), [])
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('the shipped skill map', () => {
  it('classifies every skill that exists on disk', () => {
    // The guard that was missing. A new skill silently absent from the map
    // would be charged to every phase — safe, but wrong; this makes the
    // decision explicit instead of accidental.
    const onDisk = fs
      .readdirSync(path.join(REPO, '.github/skills'))
      .filter((n) => fs.existsSync(path.join(REPO, '.github/skills', n, 'SKILL.md')))
      .sort()

    assert.deepEqual(onDisk, Object.keys(SKILL_SCOPE).sort(), 'a skill exists that the budget has never been told about')
  })

  it('resolves the same way for every phase key the budget uses', () => {
    for (const applies of Object.values(SKILL_SCOPE)) {
      for (const phase of ['Phase_0_Frame', 'Phase_1_New', 'Phase_2_FF', 'Phase_3_Apply', 'Phase_4_Verify', 'Phase_5_Archive']) {
        assert.equal(typeof applies(phase), 'boolean', `scope for ${phase} must be a plain boolean`)
      }
    }
  })
})
