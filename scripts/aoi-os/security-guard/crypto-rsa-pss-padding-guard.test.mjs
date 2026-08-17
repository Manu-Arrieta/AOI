import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoRsaPssPaddingSafety } from './crypto-rsa-pss-padding-guard.mjs'

test('auditCryptoRsaPssPaddingSafety approves RSA-PSS with explicit saltLength', () => {
  const code = `
const signature = crypto.sign('sha256', data, {
  key: privateKey,
  padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
  saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
});
`
  const result = auditCryptoRsaPssPaddingSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.rsaPssProof, 'RSA_PSS_PADDING_CANONICAL')
  assert.equal(result.violationsCount, 0)
})

test('auditCryptoRsaPssPaddingSafety detects RSA-PSS without explicit saltLength', () => {
  const code = `
const signature = crypto.sign('sha256', data, {
  key: privateKey,
  padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
});
`
  const result = auditCryptoRsaPssPaddingSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.rsaPssProof, 'UNSPECIFIED_RSA_PSS_SALTLEN_RISK')
  assert.equal(result.violationsCount, 1)
})
