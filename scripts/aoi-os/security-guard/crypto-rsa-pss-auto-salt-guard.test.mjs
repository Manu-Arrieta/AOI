import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoRsaPssAutoSaltSafety } from './crypto-rsa-pss-auto-salt-guard.mjs'

test('auditCryptoRsaPssAutoSaltSafety approves RSA_PSS_SALTLEN_AUTO in verify call', () => {
  const code = `
const verified = crypto.verify('sha256', buffer, publicKey, signature, {
  padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
  saltLength: crypto.constants.RSA_PSS_SALTLEN_AUTO,
});
`
  const result = auditCryptoRsaPssAutoSaltSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.rsaPssAutoSaltProof, 'SECURE_RSA_PSS_AUTO_SALT_VERIFIED')
})

test('auditCryptoRsaPssAutoSaltSafety detects missing or fixed saltLength in RSA-PSS verify', () => {
  const code = `
const verified = crypto.verify('sha256', buffer, publicKey, signature, {
  padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
});
`
  const result = auditCryptoRsaPssAutoSaltSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.rsaPssAutoSaltProof, 'INSECURE_OR_FIXED_RSA_PSS_VERIFY_SALT_DETECTED')
  assert.ok(result.violations.includes('RSA_PSS_VERIFY_MISSING_EXPLICIT_AUTO_OR_DIGEST_SALTLENGTH'))
})

test('auditCryptoRsaPssAutoSaltSafety returns safe when no RSA-PSS verify operation is present', () => {
  const code = `
const verified = crypto.verify('sha256', buffer, publicKey, signature);
`
  const result = auditCryptoRsaPssAutoSaltSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.rsaPssAutoSaltProof, 'NO_RSA_PSS_VERIFY_OPERATION_DETECTED')
})
