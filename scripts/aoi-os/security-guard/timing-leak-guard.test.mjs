import test from 'node:test'
import assert from 'node:assert/strict'
import { auditTimingSafety } from './timing-leak-guard.mjs'

test('auditTimingSafety approves constant-time crypto implementations', () => {
  const safeCode = `
import crypto from 'node:crypto';
export function verifySignature(sig1: Buffer, sig2: Buffer) {
  return crypto.timingSafeEqual(sig1, sig2);
}
`
  const result = auditTimingSafety(safeCode)
  assert.equal(result.safe, true)
  assert.equal(result.timingProof, 'CONSTANT_TIME_CRYPTO_VERIFIED')
  assert.equal(result.vulnerabilitiesCount, 0)
})

test('auditTimingSafety catches insecure === comparisons on secrets', () => {
  const insecureCode = `
export function checkAuth(token: string, expectedToken: string) {
  if (token === expectedToken) {
    return true;
  }
  return false;
}
`
  const result = auditTimingSafety(insecureCode)
  assert.equal(result.safe, false)
  assert.equal(result.timingProof, 'TIMING_ATTACK_VULNERABILITY_DETECTED')
  assert.ok(result.vulnerabilities.some((v) => v.identifier === 'token'))
})
