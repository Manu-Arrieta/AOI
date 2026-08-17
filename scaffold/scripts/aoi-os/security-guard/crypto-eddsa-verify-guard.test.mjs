import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoEddsaVerifySafety } from './crypto-eddsa-verify-guard.mjs'

test('auditCryptoEddsaVerifySafety approves Ed25519 verify with null algorithm', () => {
  const code = `
const isValid = crypto.verify(null, data, ed25519PublicKey, signature);
`
  const result = auditCryptoEddsaVerifySafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.eddsaProof, 'EDDSA_VERIFY_ALGORITHM_CANONICAL')
  assert.equal(result.violationsCount, 0)
})

test('auditCryptoEddsaVerifySafety detects invalid digest algorithm passed to Ed25519 verify', () => {
  const code = `
const isValid = crypto.verify('sha256', data, ed25519PublicKey, signature);
`
  const result = auditCryptoEddsaVerifySafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.eddsaProof, 'INVALID_EDDSA_VERIFY_ALGORITHM_DETECTED')
  assert.equal(result.violationsCount, 1)
})
