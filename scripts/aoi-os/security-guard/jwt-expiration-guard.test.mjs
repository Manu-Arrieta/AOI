import test from 'node:test'
import assert from 'node:assert/strict'
import { auditJwtExpirationSafety } from './jwt-expiration-guard.mjs'

test('auditJwtExpirationSafety approves JWT creation with explicit expiresIn option', () => {
  const code = `
export function createSessionToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '15m' });
}
`
  const result = auditJwtExpirationSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.jwtProof, 'JWT_EXPIRATION_INVARIANT_PROVEN')
  assert.equal(result.violationsCount, 0)
})

test('auditJwtExpirationSafety detects perpetual JWT creation without expiration policy', () => {
  const code = `
export function createSessionToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET);
}
`
  const result = auditJwtExpirationSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.jwtProof, 'UNBOUNDED_PERPETUAL_TOKEN_DETECTED')
  assert.equal(result.violationsCount, 1)
})
