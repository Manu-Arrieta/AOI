import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { auditSrp, listSourceFiles, LEGACY_BUDGET, MAX_LOC } from './validate-srp.mjs'

/**
 * Builds a throwaway tree whose files have exact line counts. `setup.sh` marks
 * it as the development repository, which is where the full audit applies;
 * pass devRepo:false to model an installed workspace.
 */
function treeWith(sizes, { devRepo = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-srp-'))
  if (devRepo && !sizes['setup.sh']) fs.writeFileSync(path.join(root, 'setup.sh'), '#!/usr/bin/env bash\n')
  for (const [rel, lines] of Object.entries(sizes)) {
    const full = path.join(root, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    // `lines` here is the count validateFileSizes reports: newlines + 1.
    fs.writeFileSync(full, 'x\n'.repeat(lines - 1))
  }
  return root
}

describe('listSourceFiles', () => {
  it('skips vendored trees and the scaffold mirror', () => {
    const root = treeWith({
      'setup.sh': 2,
      'scripts/real.mjs': 5,
      'scripts/node_modules/vendor.mjs': 5,
      'scripts/scaffold/mirror.mjs': 5,
      'scripts/notes.md': 5,
    })

    assert.deepEqual(listSourceFiles(root), ['scripts/real.mjs'])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('audits everything in the development repository', () => {
    const root = treeWith({ 'setup.sh': 2, 'scripts/aoi.mjs': 5, 'scripts/owner-script.mjs': 5 })

    assert.deepEqual(listSourceFiles(root), ['scripts/aoi.mjs', 'scripts/owner-script.mjs'])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it("audits only governed files in an installed workspace, not the owner's own", () => {
    const root = treeWith(
      { 'scripts/aoi.mjs': 5, 'scaffold/scripts/aoi.mjs': 5, 'scripts/owner-script.mjs': 5 },
      { devRepo: false }
    )

    assert.deepEqual(listSourceFiles(root), ['scripts/aoi.mjs'])
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('auditSrp ratchet', () => {
  it('passes when a legacy file stays at its recorded size', () => {
    const root = treeWith({ 'scripts/legacy.mjs': 341 })
    const report = auditSrp(root, { 'scripts/legacy.mjs': 341 })

    assert.deepEqual(report.added, [])
    assert.deepEqual(report.grown, [])
    assert.deepEqual(report.resolved, [])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('fails when a file not on the list crosses the limit', () => {
    const root = treeWith({ 'scripts/fresh.mjs': 301 })
    const report = auditSrp(root, {})

    assert.equal(report.added.length, 1)
    assert.equal(report.added[0].file, 'scripts/fresh.mjs')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('fails when legacy debt grows by even one line', () => {
    const root = treeWith({ 'scripts/legacy.mjs': 342 })
    const report = auditSrp(root, { 'scripts/legacy.mjs': 341 })

    assert.equal(report.grown.length, 1)
    assert.equal(report.grown[0].lines, 342)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('accepts legacy debt shrinking, since the ratchet only turns one way', () => {
    const root = treeWith({ 'scripts/legacy.mjs': 320 })
    const report = auditSrp(root, { 'scripts/legacy.mjs': 341 })

    assert.deepEqual(report.grown, [])
    assert.deepEqual(report.resolved, [])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('fails when a budgeted file is finally under the limit, so the list cannot rot', () => {
    const root = treeWith({ 'scripts/legacy.mjs': 120 })
    const report = auditSrp(root, { 'scripts/legacy.mjs': 341 })

    assert.deepEqual(report.resolved, ['scripts/legacy.mjs'])
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('the shipped budget', () => {
  it('records every legacy file above the limit and nothing else', () => {
    for (const [file, lines] of Object.entries(LEGACY_BUDGET)) {
      assert.ok(lines > MAX_LOC, `${file} is on the debt list but does not exceed ${MAX_LOC}`)
    }
  })
})
