import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  buildDebuggingTurns,
  buildDiscoveryCorpus,
  captureRealTestRun,
  fallbackDebuggingTurns,
  fallbackDiscoveryCorpus,
  FALLBACK_CRASH,
} from './real-corpus.mjs'

/** Builds a throwaway source tree to sample. */
function treeWith(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-corpus-test-'))
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, body)
  }
  return root
}

describe('buildDiscoveryCorpus', () => {
  it('splits real files into signal and noise by the feature keyword', () => {
    const root = treeWith({
      'scripts/token-evaluator.mjs': 'export const budget = 1',
      'scripts/unrelated-parser.mjs': 'export const parse = () => {}',
      'scripts/deep/uses-token.mjs': '// mentions token in the body\n',
    })

    const corpus = buildDiscoveryCorpus(root, { keyword: 'token', searchDir: 'scripts' })
    const ids = (list) => list.map((i) => i.id).sort()

    assert.deepEqual(ids(corpus.signalItems), ['scripts/deep/uses-token.mjs', 'scripts/token-evaluator.mjs'])
    assert.deepEqual(ids(corpus.backgroundItems), ['scripts/unrelated-parser.mjs'])
    assert.equal(corpus.sampled, 3)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('excludes test files and vendored directories from the sample', () => {
    const root = treeWith({
      'scripts/real.mjs': 'export const a = 1',
      'scripts/real.test.mjs': 'should not be sampled',
      'scripts/node_modules/vendor.mjs': 'should not be sampled',
      'scripts/scaffold/mirror.mjs': 'should not be sampled',
    })

    const corpus = buildDiscoveryCorpus(root, { keyword: 'nothing', searchDir: 'scripts' })
    assert.equal(corpus.sampled, 1)
    assert.equal(corpus.backgroundItems[0].id, 'scripts/real.mjs')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('returns an empty corpus when the search directory does not exist', () => {
    const root = treeWith({ 'other/file.mjs': 'x' })
    const corpus = buildDiscoveryCorpus(root, { keyword: 'token', searchDir: 'scripts' })

    assert.deepEqual(corpus, { signalItems: [], backgroundItems: [], sampled: 0 })
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('honours the maxFiles cap so the benchmark stays bounded', () => {
    const files = {}
    for (let i = 0; i < 12; i++) files[`scripts/f${i}.mjs`] = 'export const x = 1'
    const root = treeWith(files)

    assert.equal(buildDiscoveryCorpus(root, { keyword: 'z', searchDir: 'scripts', maxFiles: 5 }).sampled, 5)
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('captureRealTestRun', () => {
  it('captures genuine runner diagnostics from a test that really fails', () => {
    const run = captureRealTestRun()

    assert.equal(run.ok, true)
    // Real node:test output, not a hand-written trace.
    assert.match(run.failing, /fail 2/)
    assert.match(run.failing, /AssertionError|✖/)
    assert.match(run.passing, /pass 1/)
    // The failing run must be materially noisier — that is the whole premise
    // of distilling and tombstoning it.
    assert.ok(run.failing.length > run.passing.length)
  })
})

describe('buildDebuggingTurns', () => {
  it('threads the captured output through a RED -> fix -> GREEN sequence', () => {
    const turns = buildDebuggingTurns({ failing: 'REAL-FAILURE', passing: 'REAL-PASS' })

    assert.equal(turns.length, 5)
    assert.equal(turns[0].content, 'REAL-FAILURE')
    assert.equal(turns[2].content, 'REAL-FAILURE')
    assert.equal(turns[4].content, 'REAL-PASS')
    assert.deepEqual(turns.map((t) => t.tool), ['test', 'edit_file', 'test', 'edit_file', 'test'])
  })
})

describe('fallbacks', () => {
  it('exist only as a labelled last resort and are shaped like the real thing', () => {
    const corpus = fallbackDiscoveryCorpus()
    assert.equal(corpus.signalItems.length, 10)
    assert.equal(corpus.backgroundItems.length, 20)
    // sampled === 0 is the tell that nothing real was read.
    assert.equal(corpus.sampled, 0)

    assert.equal(fallbackDebuggingTurns().length, 5)
    assert.match(FALLBACK_CRASH, /AssertionError/)
  })
})
