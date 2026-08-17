import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoRsaKeyLengthSafety } from './crypto-rsa-key-length-guard.mjs'

test('auditCryptoRsaKeyLengthSafety approves RSA key generation with 4096-bit modulus', () => {
  const code = `
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
`
  const result = auditCryptoRsaKeyLengthSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.rsaProof, 'ROBUST_RSA_MODULUS_LENGTH_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditCryptoRsaKeyLengthSafety detects weak 1024-bit RSA key generation', () => {
  const code = `
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 1024,
});
`
  const result = auditCryptoRsaKeyLengthSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.rsaProof, 'INSECURE_RSA_KEY_LENGTH_VULNERABILITY')
  assert.equal(result.violationsCount, 1)
})
