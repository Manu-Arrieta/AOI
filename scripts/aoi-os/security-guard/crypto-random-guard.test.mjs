import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoRandomSafety } from './crypto-random-guard.mjs'

test('auditCryptoRandomSafety approves CSPRNG randomBytes token generation', () => {
  const code = `
import crypto from 'node:crypto';
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}
`
  const result = auditCryptoRandomSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.randomProof, 'CSPRNG_RANDOMNESS_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditCryptoRandomSafety detects Math.random in generateToken', () => {
  const code = `
function generateToken() {
  return Math.random().toString(36).substring(2);
}
`
  const result = auditCryptoRandomSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.randomProof, 'INSECURE_PSEUDORANDOM_TOKEN_RISK')
  assert.equal(result.violationsCount, 1)
})
