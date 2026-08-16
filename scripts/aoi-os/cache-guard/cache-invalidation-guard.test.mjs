import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCacheInvalidation } from './cache-invalidation-guard.mjs'

test('auditCacheInvalidation approves mutation endpoint with no-store header', () => {
  const code = `
export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate');
  return { success: true };
});
`
  const result = auditCacheInvalidation(code, 'POST')
  assert.equal(result.safe, true)
  assert.equal(result.cacheProof, 'CACHE_CONTROL_INVALIDATION_PROVEN')
  assert.equal(result.violationsCount, 0)
})

test('auditCacheInvalidation detects mutation endpoint missing cache invalidation header', () => {
  const code = `
export default defineEventHandler((event) => {
  return { success: true };
});
`
  const result = auditCacheInvalidation(code, 'POST')
  assert.equal(result.safe, false)
  assert.equal(result.cacheProof, 'MISSING_CACHE_INVALIDATION_DIRECTIVE')
  assert.equal(result.violationsCount, 1)
})
