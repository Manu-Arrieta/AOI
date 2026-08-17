import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoAlgorithmSafety } from './crypto-algorithm-guard.mjs'

test('auditCryptoAlgorithmSafety approves SHA-256 and modern digests', () => {
  const code = `
import crypto from 'node:crypto';
function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd).digest('hex');
}
`
  const result = auditCryptoAlgorithmSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.cryptoProof, 'SAFE_CRYPTO_ALGORITHMS_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditCryptoAlgorithmSafety detects insecure MD5 digest', () => {
  const code = `
import crypto from 'node:crypto';
function hashToken(token) {
  return crypto.createHash('md5').update(token).digest('hex');
}
`
  const result = auditCryptoAlgorithmSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.cryptoProof, 'INSECURE_LEGACY_CRYPTO_DETECTED')
  assert.equal(result.violationsCount, 1)
})
