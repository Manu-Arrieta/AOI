import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoRsaPssSaltLengthSafety } from './crypto-rsa-pss-salt-length-guard.mjs'

test('auditCryptoRsaPssSaltLengthSafety approves RSA_PSS_SALTLEN_DIGEST constant', () => {
  const code = `
const signature = crypto.sign('sha256', buffer, {
  key: privateKey,
  padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
  saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
});
`
  const result = auditCryptoRsaPssSaltLengthSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.rsaPssSaltLengthProof, 'SECURE_RSA_PSS_SALTLENGTH_VERIFIED')
})

test('auditCryptoRsaPssSaltLengthSafety detects missing saltLength specification in RSA-PSS', () => {
  const code = `
const signature = crypto.sign('sha256', buffer, {
  key: privateKey,
  padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
});
`
  const result = auditCryptoRsaPssSaltLengthSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.rsaPssSaltLengthProof, 'INSECURE_OR_MISSING_RSA_PSS_SALTLENGTH_DETECTED')
  assert.ok(result.violations.includes('MISSING_EXPLICIT_SECURE_RSA_PSS_SALTLENGTH_CONSTANT'))
})

test('auditCryptoRsaPssSaltLengthSafety detects short insecure salt length', () => {
  const code = `
const signature = crypto.sign('sha256', buffer, {
  key: privateKey,
  padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
  saltLength: 4,
});
`
  const result = auditCryptoRsaPssSaltLengthSafety(code)
  assert.equal(result.safe, false)
  assert.ok(result.violations.includes('INSECURE_SHORT_OR_INVALID_RSA_PSS_SALTLENGTH'))
})
