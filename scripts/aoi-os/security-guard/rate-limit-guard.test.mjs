import test from 'node:test'
import assert from 'node:assert/strict'
import { auditRateLimiting } from './rate-limit-guard.mjs'

test('auditRateLimiting approves public route with rate limiting configured', () => {
  const code = `
export default defineEventHandler(async (event) => {
  await useRateLimiter(event, { maxRequests: 100, windowMs: 60000 });
  return { status: 'ok' };
});
`
  const result = auditRateLimiting(code, true)
  assert.equal(result.safe, true)
  assert.equal(result.rateLimitProof, 'RATE_LIMITING_PROTECTION_PROVEN')
  assert.equal(result.violationsCount, 0)
})

test('auditRateLimiting detects public route missing rate limiting protection', () => {
  const code = `
export default defineEventHandler(async (event) => {
  return { status: 'ok' };
});
`
  const result = auditRateLimiting(code, true)
  assert.equal(result.safe, false)
  assert.equal(result.rateLimitProof, 'UNTHROTTLED_PUBLIC_ENDPOINT_DETECTED')
  assert.equal(result.violationsCount, 1)
})
