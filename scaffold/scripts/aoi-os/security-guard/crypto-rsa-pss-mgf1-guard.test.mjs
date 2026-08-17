import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoRsaPssMgf1Safety } from './crypto-rsa-pss-mgf1-guard.mjs'

test('auditCryptoRsaPssMgf1Safety approves explicit secure mgf1Hash sha256', () => {
  const code = `
const signature = crypto.sign('sha256', buffer, {
  key: privateKey,
  padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
  saltLength: 32,
  mgf1Hash: 'sha256'
});
`
  const result = auditCryptoRsaPssMgf1Safety(code)
  assert.equal(result.safe, true)
  assert.equal(result.rsaPssMgf1Proof, 'SECURE_RSA_PSS_MGF1_HASH_VERIFIED')
})

test('auditCryptoRsaPssMgf1Safety detects missing mgf1Hash in RSA-PSS operations', () => {
  const code = `
const signature = crypto.sign('sha256', buffer, {
  key: privateKey,
  padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
  saltLength: 32
});
`
  const result = auditCryptoRsaPssMgf1Safety(code)
  assert.equal(result.safe, false)
  assert.equal(result.rsaPssMgf1Proof, 'INSECURE_OR_MISSING_RSA_PSS_MGF1_HASH_DETECTED')
  assert.ok(result.violations.includes('MISSING_EXPLICIT_SECURE_MGF1_HASH_IN_RSA_PSS'))
})

test('auditCryptoRsaPssMgf1Safety detects insecure SHA-1 mgf1Hash in RSA-PSS', () => {
  const code = `
const signature = crypto.sign('sha256', buffer, {
  key: privateKey,
  padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
  mgf1Hash: 'sha1'
});
`
  const result = auditCryptoRsaPssMgf1Safety(code)
  assert.equal(result.safe, false)
  assert.ok(result.violations.includes('INSECURE_MGF1_HASH_ALGORITHM_SPECIFIED'))
})
