import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoTimingSafeBufferSafety } from './crypto-timing-safe-buffer-guard.mjs'

test('auditCryptoTimingSafeBufferSafety approves signature verification with timingSafeEqual', () => {
  const code = `
function verifySignature(expectedSignature, actualSignature) {
  const bufA = Buffer.from(expectedSignature, 'hex');
  const bufB = Buffer.from(actualSignature, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
`
  const result = auditCryptoTimingSafeBufferSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.timingSafeProof, 'CONSTANT_TIME_BUFFER_COMPARISON_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditCryptoTimingSafeBufferSafety detects variable-time === comparison on signature', () => {
  const code = `
function verifySignature(expectedSignature, actualSignature) {
  return expectedSignature === actualSignature;
}
`
  const result = auditCryptoTimingSafeBufferSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.timingSafeProof, 'TIMING_SIDE_CHANNEL_RISK_DETECTED')
  assert.equal(result.violationsCount, 1)
})
