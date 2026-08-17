import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoKdfSafety } from './crypto-kdf-guard.mjs'

test('auditCryptoKdfSafety approves PBKDF2 with 100,000+ iterations', () => {
  const code = `
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
}
`
  const result = auditCryptoKdfSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.kdfProof, 'SAFE_KDF_PARAMETERS_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditCryptoKdfSafety detects PBKDF2 with weak iteration count (1000)', () => {
  const code = `
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512');
}
`
  const result = auditCryptoKdfSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.kdfProof, 'WEAK_KEY_DERIVATION_RISK_DETECTED')
  assert.equal(result.violationsCount, 1)
  assert.equal(result.violations[0].iterations, 1000)
})
