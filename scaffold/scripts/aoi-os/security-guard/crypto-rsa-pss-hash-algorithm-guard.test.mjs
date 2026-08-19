import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoRsaPssHashAlgorithmSafety } from './crypto-rsa-pss-hash-algorithm-guard.mjs'

test('auditCryptoRsaPssHashAlgorithmSafety approves sha256 in RSA-PSS sign call', () => {
  const code = `
const signature = crypto.sign('sha256', buffer, {
  key: privateKey,
  padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
  saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
});
`
  const result = auditCryptoRsaPssHashAlgorithmSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.algorithm, 'sha256')
  assert.equal(result.rsaPssHashProof, 'SECURE_RSA_PSS_HASH_ALGORITHM_VERIFIED')
})

test('auditCryptoRsaPssHashAlgorithmSafety detects weak sha1 in RSA-PSS sign call', () => {
  const code = `
const signature = crypto.sign('sha1', buffer, {
  key: privateKey,
  padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
});
`
  const result = auditCryptoRsaPssHashAlgorithmSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.algorithm, 'sha1')
  assert.equal(result.rsaPssHashProof, 'INSECURE_OR_WEAK_RSA_PSS_HASH_DETECTED')
  assert.ok(result.violations[0].includes('INSECURE_OR_WEAK_RSA_PSS_HASH_ALGORITHM'))
})

test('auditCryptoRsaPssHashAlgorithmSafety returns safe when no RSA-PSS operation is present', () => {
  const code = `
const hash = crypto.createHash('sha256').update('data').digest('hex');
`
  const result = auditCryptoRsaPssHashAlgorithmSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.rsaPssHashProof, 'NO_RSA_PSS_HASH_OPERATION_DETECTED')
})
