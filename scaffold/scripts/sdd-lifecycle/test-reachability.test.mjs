import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { collectTestSources, dropUnreachableTests } from './test-reachability.mjs'

/** A workspace whose vitest config only collects `test/**`. */
function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-reach-'))
  fs.mkdirSync(path.join(root, 'app/utils'), { recursive: true })
  fs.mkdirSync(path.join(root, 'test'), { recursive: true })
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'vitest run' } }))
  fs.writeFileSync(path.join(root, 'vitest.config.ts'), `export default { test: { include: ['test/**/*.test.ts'] } }\n`)
  return root
}

const clean = (root) => fs.rmSync(root, { recursive: true, force: true })

describe('a test no runner collects counts for nothing', () => {
  it('drops the unreachable file and keeps the reachable one', () => {
    // The live-cycle scenario exactly: a delegated agent wrote its test under
    // app/**, the Invariant Gate matched its tags, and vitest never collected
    // it because `include` is pinned to test/**.
    const root = workspace()
    const orphan = path.join(root, 'app/utils/budget.test.ts')
    const reachable = path.join(root, 'test/budget.test.ts')
    fs.writeFileSync(orphan, `it('BIC-1:never.1', () => {})`)
    fs.writeFileSync(reachable, `it('BIC-1:never.2', () => {})`)

    const { kept, dropped } = dropUnreachableTests(root, collectTestSources(root))

    assert.deepEqual(dropped.map((f) => path.basename(path.dirname(f))), ['utils'])
    assert.equal(kept.length, 1)
    assert.match(kept[0].file, /test\/budget\.test\.ts$/)
    clean(root)
  })

  it('keeps everything when reachability cannot be determined', () => {
    // No package.json: the question has no answer, and discarding a real test
    // because we could not ask would be the same error pointed the other way.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-reach-'))
    fs.writeFileSync(path.join(root, 'a.test.mjs'), 'x')
    const sources = collectTestSources(root)

    const { kept, dropped } = dropUnreachableTests(root, sources)

    assert.equal(kept.length, sources.length)
    assert.deepEqual(dropped, [])
    clean(root)
  })

  it('never counts the scaffold mirror as an authoritative test tree', () => {
    // A mirrored copy satisfying a contract on its own would let a rule be
    // "enforced" by a file that is only a duplicate of another.
    const root = workspace()
    fs.mkdirSync(path.join(root, 'scaffold/test'), { recursive: true })
    fs.writeFileSync(path.join(root, 'scaffold/test/mirror.test.ts'), `it('BIC-1:never.1', () => {})`)

    assert.equal(collectTestSources(root).filter((s) => s.file.includes('scaffold')).length, 0)
    clean(root)
  })
})
