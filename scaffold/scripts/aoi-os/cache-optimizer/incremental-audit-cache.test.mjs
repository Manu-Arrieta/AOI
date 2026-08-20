import test from 'node:test'
import assert from 'node:assert/strict'
import { createIncrementalAuditCache, computeContentHash } from './incremental-audit-cache.mjs'

test('createIncrementalAuditCache caches results and tracks hits/misses', () => {
  const cache = createIncrementalAuditCache()
  const filePath = 'server/api/tasks.ts'
  const ruleName = 'atomic-fsync'
  const content = 'export const x = 1;'

  let rawCallCount = 0
  const mockAudit = (code) => {
    rawCallCount++
    return { safe: true, codeLength: code.length }
  }

  const cachedAudit = cache.wrapAudit(ruleName, mockAudit)

  // 1. First invocation: Miss
  const res1 = cachedAudit(filePath, content)
  assert.equal(res1.safe, true)
  assert.equal(rawCallCount, 1)

  // 2. Second invocation with same content: Hit
  const res2 = cachedAudit(filePath, content)
  assert.equal(res2.safe, true)
  assert.equal(rawCallCount, 1) // Unchanged!

  // 3. Third invocation with modified content: Miss & re-evaluate
  const res3 = cachedAudit(filePath, 'export const x = 2;')
  assert.equal(res3.safe, true)
  assert.equal(rawCallCount, 2)

  const stats = cache.getStats()
  assert.equal(stats.hits, 1)
  assert.equal(stats.misses, 2)
  assert.equal(stats.size, 2)
})

test('computeContentHash generates deterministic 64-char sha256', () => {
  const hash1 = computeContentHash('hello')
  const hash2 = computeContentHash('hello')
  const hash3 = computeContentHash('world')
  assert.equal(hash1, hash2)
  assert.notEqual(hash1, hash3)
  assert.equal(hash1.length, 64)
})
