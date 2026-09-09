/**
 * scripts/multi-harness/icm-protocol-completeness.test.mjs
 *
 * `icm-protocol.instructions.md` carries `applyTo: "**"`, so it is injected
 * into every single operation — the most expensive surface in the system and
 * therefore the most tempting to trim. Trimming it is legitimate; losing an
 * operational fact while trimming it is not, and the loss would be invisible:
 * an agent that no longer knows an architecture decision is stored as
 * `critical` simply stores it wrong, forever, with no error anywhere.
 *
 * This suite pins the operational content the file must keep, independently of
 * how it is laid out. It was written after a compression pass silently dropped
 * the `low` importance level, which nothing else would have caught.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const PROTOCOL = path.join(ROOT, '.github/instructions/icm-protocol.instructions.md')
const text = fs.readFileSync(PROTOCOL, 'utf8')

describe('ICM protocol — always-injected surface', () => {
  it('is injected everywhere, which is why its size matters', () => {
    assert.match(text, /^applyTo:\s*"\*\*"/m)
  })

  it('names all five memory systems', () => {
    for (const system of ['Memories', 'Memoirs', 'Facts', 'Feedback', 'Transcripts']) {
      assert.match(text, new RegExp(`\\b${system}\\b`), `memory system missing: ${system}`)
    }
  })

  it('defines every importance level with its decay and prune behaviour', () => {
    for (const level of ['critical', 'high', 'medium', 'low']) {
      assert.match(text, new RegExp(`\\| \`${level}\` \\|`), `importance level missing from the policy table: ${level}`)
    }
  })

  it('says which triggers map to each importance level', () => {
    // The forward direction — "this just happened, what importance?" — is the
    // one an agent needs mid-work. Dropping `low` here is the exact regression
    // this test exists for.
    for (const level of ['critical', 'high', 'medium', 'low']) {
      assert.match(text, new RegExp(`\`${level}\`\\s*→`), `no trigger list for importance: ${level}`)
    }
  })

  it('keeps every trigger that used to have its own row', () => {
    const triggers = [
      /arquitectura|architecture/i,
      /convenci|convention/i,
      /preferencia|preference/i,
      /spec/i,
      /error/i,
      /QA|verify/i,
    ]
    for (const t of triggers) assert.match(text, t, `store trigger lost: ${t}`)
  })

  it('keeps the operations that are not a plain store', () => {
    for (const verb of [
      'icm wake-up',
      'icm_memory_recall',
      'icm facts set',
      'icm memoir distill',
      'icm briefing',
      'icm_memory_consolidate',
    ]) {
      assert.ok(text.includes(verb), `non-store operation lost: ${verb}`)
    }
  })

  it('keeps workspace isolation, which prevents memory bleed across projects', () => {
    assert.match(text, /\{WORKSPACE\}/)
    assert.match(text, /git remote get-url origin/)
  })

  it('keeps the read-only policy that protects core topics from sandboxes', () => {
    assert.match(text, /ICM_READONLY|--read-only/)
  })

  it('stays within a budget, because every token here is paid on every operation', () => {
    const tokens = Math.round(text.length / 4)
    assert.ok(tokens <= 2200, `icm-protocol grew to ${tokens} tokens; it is injected on every operation`)
  })
})

describe('the ICM doctrine agrees across every surface that teaches it', () => {
  // Two surfaces taught ICM at once and disagreed: the instructions declared
  // five memory systems, the skill declared four and never mentioned Facts at
  // all. Both are injected in every phase, so an agent read both and believed
  // whichever it saw last.
  //
  // Deduplicating was not an option: compile-rules maps the antigravity
  // harness to `.agents/` and NOT to `.github/instructions/`, so the skill is
  // the only ICM doctrine that harness ever sees. Both must exist, so both
  // must agree — and only a test can hold that.
  const SKILL = path.join(ROOT, '.github/skills/icm/SKILL.md')
  const skill = fs.readFileSync(SKILL, 'utf8')

  const SYSTEMS = ['Memories', 'Memoirs', 'Facts', 'Feedback', 'Transcripts']

  it('the skill names every memory system the protocol declares', () => {
    for (const system of SYSTEMS) {
      assert.match(skill, new RegExp(`\\b${system}\\b`), `the ICM skill omits the ${system} system`)
    }
  })

  it('both surfaces claim the same number of systems', () => {
    assert.match(text, /5-Method|five memory systems/i, 'the protocol changed its system count')
    assert.match(skill, /five memory systems/i, 'the skill disagrees with the protocol on how many systems exist')
  })

  it('the skill teaches how to write a fact, not only how to store a memory', () => {
    // Facts is the O(1) exact system the BIC Invariant Gate reads. A skill
    // that never shows `icm facts set` leaves contracts unpersisted and the
    // gate with nothing to check.
    assert.match(skill, /icm facts set/, 'the skill never shows how to write a fact')
  })

  it('the skill description names facts, since the description is its trigger', () => {
    // The harness decides whether to load a skill from this line. Omitting
    // facts there means the skill may not even load for a task about facts.
    const description = /^description:.*$/m.exec(skill)?.[0] ?? ''
    assert.match(description, /facts/i, 'the trigger text omits facts')
  })
})

describe('the RTK doctrine reaches every audience', () => {
  // The guarantee has not changed: no harness may lose the mappings. Where it
  // is checked has.
  //
  // `.github/instructions/` reaches the orchestrator (its `applyTo` is `**`)
  // and every subagent as "Project Standards". Antigravity reads neither, and
  // for a long time that was solved by hand-writing the whole doctrine a
  // second time into `.github/skills/rtk/SKILL.md` and mirroring it — which
  // made the ORCHESTRATOR pay for two full copies of a rule it already had,
  // 502 tokens in all six phases.
  //
  // Now `aoi:sync-rules` DERIVES the antigravity copy from the instruction, so
  // the skill can shrink to its trigger. This test therefore holds the
  // instruction against the derived copy, which is the file antigravity
  // actually loads, instead of against a duplicate that no longer needs to be
  // one.
  const instructions = fs.readFileSync(path.join(ROOT, '.github/instructions/rtk.instructions.md'), 'utf8')
  const derived = fs.readFileSync(path.join(ROOT, '.agents/skills/rtk/SKILL.md'), 'utf8')

  it('the derived antigravity copy teaches every command mapping', () => {
    // The skill was once missing `docker logs` and `pytest`, so an agent on a
    // harness that only reads skills never learned to compress either. Deriving
    // makes that class of drift impossible rather than merely detected.
    for (const cmd of ['git status', 'git log', 'find', 'grep', 'docker ps', 'docker logs', 'pytest', 'diff']) {
      assert.ok(instructions.includes(cmd), `the RTK instructions lost the ${cmd} mapping`)
      assert.ok(derived.includes(cmd), `the derived antigravity skill omits the ${cmd} mapping`)
    }
  })

  it('the slim skill still carries the rule itself, not only a pointer', () => {
    // Shrinking it is fine; emptying it is not. A harness that loads skills
    // and somehow misses the instruction must still be told to prefix.
    const skill = fs.readFileSync(path.join(ROOT, '.github/skills/rtk/SKILL.md'), 'utf8')
    assert.match(skill, /rtk/i)
    assert.match(skill, /\.github\/instructions\/rtk\.instructions\.md/, 'la skill no dice dónde vive la regla completa')
  })

  it('both list the same exceptions, since prefixing those breaks the command', () => {
    for (const exception of ['icm', 'specify', 'nteractive']) {
      assert.ok(instructions.toLowerCase().includes(exception.toLowerCase()), `instructions lost the ${exception} exception`)
      assert.ok(derived.toLowerCase().includes(exception.toLowerCase()), `the derived skill lost the ${exception} exception`)
    }
  })
})
