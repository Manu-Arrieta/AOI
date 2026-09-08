import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  createLedger,
  estimateTokens,
  findRealTaskDir,
  formatTotals,
  provenanceBreakdown,
  readIfPresent,
  toTableRows,
  tryCommand,
  FIXTURE,
  MEASURED,
  SKIPPED,
} from './token-accounting.mjs'

describe('estimateTokens', () => {
  it('approximates four characters per token', () => {
    assert.equal(estimateTokens('a'.repeat(400)), 100)
    assert.equal(estimateTokens(''), 0)
    assert.equal(estimateTokens(null), 0)
  })
})

describe('ledger accounting', () => {
  it('accumulates savings and percentages across phases', () => {
    const ledger = createLedger()
    ledger.record('P1', 'one', { raw: 1000, opt: 250, provenance: MEASURED })
    ledger.record('P2', 'two', { raw: 200, opt: 100, provenance: FIXTURE })

    assert.equal(ledger.phases.P1.percentSaved, '75.0%')
    assert.equal(ledger.totals.rawTokens, 1200)
    assert.equal(ledger.totals.optimizedTokens, 350)
    assert.equal(ledger.totals.savedTokens, 850)
  })

  it('keeps a skipped phase out of the totals instead of inventing a baseline', () => {
    const ledger = createLedger()
    ledger.record('P1', 'one', { raw: 1000, opt: 250, provenance: MEASURED })
    ledger.record('P2', 'two', { raw: 0, opt: 0, provenance: SKIPPED })

    assert.equal(ledger.totals.rawTokens, 1000)
    assert.equal(ledger.phases.P2.percentSaved, 'n/a')
  })

  it('never reports a negative saving when the optimized path costs more', () => {
    const ledger = createLedger()
    ledger.record('P1', 'one', { raw: 100, opt: 150, provenance: FIXTURE })
    assert.equal(ledger.phases.P1.savedTokens, 0)
  })
})

describe('provenance reporting', () => {
  it('counts each provenance class', () => {
    const ledger = createLedger()
    ledger.record('a', 'a', { raw: 10, opt: 1, provenance: MEASURED })
    ledger.record('b', 'b', { raw: 10, opt: 1, provenance: FIXTURE })
    ledger.record('c', 'c', { raw: 0, opt: 0, provenance: SKIPPED })

    assert.deepEqual(provenanceBreakdown(ledger), { measured: 1, fixture: 1, skipped: 1 })
  })

  it('exposes provenance in every table row so no number looks unearned', () => {
    const ledger = createLedger()
    ledger.record('a', 'a', { raw: 10, opt: 1, provenance: MEASURED })
    ledger.record('b', 'b', { raw: 10, opt: 1, provenance: FIXTURE })

    const rows = toTableRows(ledger)
    assert.equal(rows[0].Origen, '● real')
    assert.equal(rows[1].Origen, '○ fixture')
  })

  it('warns in the totals when any phase rests on a fixture', () => {
    const ledger = createLedger()
    ledger.record('a', 'a', { raw: 10, opt: 1, provenance: FIXTURE })

    const out = formatTotals(ledger)
    assert.match(out, /1 sobre fixtures/)
    assert.match(out, /su volumen absoluto no/)
  })

  it('omits the fixture warning when every phase was really measured', () => {
    const ledger = createLedger()
    ledger.record('a', 'a', { raw: 10, opt: 1, provenance: MEASURED })
    assert.doesNotMatch(formatTotals(ledger), /volumen absoluto no/)
  })
})

describe('findRealTaskDir', () => {
  it('returns only a task directory holding all three planning artifacts', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-ledger-'))
    const complete = path.join(root, '.tasks/feature-a/TASK-2026-001')
    const partial = path.join(root, '.tasks/feature-b/TASK-2026-002')
    fs.mkdirSync(complete, { recursive: true })
    fs.mkdirSync(partial, { recursive: true })
    for (const f of ['spec.md', 'design.md', 'tasks.md']) fs.writeFileSync(path.join(complete, f), 'x')
    fs.writeFileSync(path.join(partial, 'spec.md'), 'x')

    assert.equal(findRealTaskDir(root), complete)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('returns null when there is nothing real to measure', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-ledger-'))
    assert.equal(findRealTaskDir(root), null)
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('environment helpers', () => {
  it('tryCommand reports failure instead of throwing', () => {
    const result = tryCommand('aoi-command-that-does-not-exist', ['--version'])
    assert.equal(result.ok, false)
    assert.equal(result.stdout, '')
  })

  it('readIfPresent returns empty string for a missing file', () => {
    assert.equal(readIfPresent('/definitely/not/here.md'), '')
  })
})
