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
