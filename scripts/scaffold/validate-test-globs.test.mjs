import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { auditTestGlobs, collectTestGlobs, expandGlob } from './validate-test-globs.mjs'

/** Builds a throwaway workspace with a package.json and optional test files. */
function workspace({ scripts, files = [], devRepo = false }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-globs-'))
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts }))
  if (devRepo) fs.writeFileSync(path.join(root, 'setup.sh'), '#!/usr/bin/env bash\n')
  for (const rel of files) {
    const full = path.join(root, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, 'export const x = 1')
  }
  return root
}

describe('collectTestGlobs', () => {
  it('finds every glob across chained commands and ignores flags', () => {
    const globs = collectTestGlobs({
      'test:a': 'node --test scripts/a/*.test.mjs',
      'test:b': 'node scripts/lint.mjs && node --test --test-reporter=spec scripts/b/*.test.mjs',
      build: 'tsc -p .',
    })

    assert.deepEqual(globs.map((g) => g.glob), ['scripts/a/*.test.mjs', 'scripts/b/*.test.mjs'])
  })

  it('captures every file in a multi-file invocation', () => {
    const globs = collectTestGlobs({ 'test:x': 'node --test a/one.test.mjs a/two.test.mjs' })
    assert.equal(globs.length, 2)
  })
})

describe('expandGlob', () => {
  it('reports a directory that does not exist as absent, not empty', () => {
    const root = workspace({ scripts: {} })
    const result = expandGlob(root, 'scripts/missing/*.test.mjs')

    assert.equal(result.dirExists, false)
    assert.deepEqual(result.matches, [])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('matches only files the pattern selects', () => {
    const root = workspace({ scripts: {}, files: ['s/a.test.mjs', 's/b.test.mjs', 's/helper.mjs'] })
    const result = expandGlob(root, 's/*.test.mjs')

    assert.deepEqual(result.matches.map((m) => path.basename(m)).sort(), ['a.test.mjs', 'b.test.mjs'])
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('auditTestGlobs', () => {
  it('fails in the dev repo when a declared glob matches nothing', () => {
    // The exact shape that shipped: the directory is gone, node --test exits 0.
    const root = workspace({ scripts: { 'test:conf': 'node --test scripts/conf/*.test.mjs' }, devRepo: true })
    const report = auditTestGlobs(root)

    assert.equal(report.strict, true)
    assert.equal(report.empty.length, 1)
    assert.equal(report.empty[0].script, 'test:conf')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('tolerates a directory an installed workspace legitimately lacks', () => {
    const root = workspace({ scripts: { 'test:conf': 'node --test scripts/conf/*.test.mjs' } })
    const report = auditTestGlobs(root)

    assert.equal(report.strict, false)
    assert.equal(report.empty.length, 0)
    assert.equal(report.absent.length, 1)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('still fails an installed workspace whose existing suite was emptied', () => {
    // Erosion, not absence: the directory is there and the tests are gone.
    const root = workspace({ scripts: { 'test:x': 'node --test s/*.test.mjs' }, files: ['s/helper.mjs'] })
    const report = auditTestGlobs(root)

    assert.equal(report.strict, false)
    assert.equal(report.empty.length, 1)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('passes when every declared glob resolves', () => {
    const root = workspace({ scripts: { 'test:x': 'node --test s/*.test.mjs' }, files: ['s/a.test.mjs'], devRepo: true })
    const report = auditTestGlobs(root)

    assert.equal(report.empty.length, 0)
    assert.equal(report.checked, 1)
    fs.rmSync(root, { recursive: true, force: true })
  })
})
