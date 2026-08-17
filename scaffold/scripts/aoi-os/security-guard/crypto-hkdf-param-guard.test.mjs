import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoHkdfParamSafety } from './crypto-hkdf-param-guard.mjs'

test('auditCryptoHkdfParamSafety approves HKDF with sha512 digest', () => {
  const code = `
const key = crypto.hkdfSync('sha512', ikm, salt, info, 64);
`
  const result = auditCryptoHkdfParamSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.hkdfProof, 'ROBUST_HKDF_PARAMETERS_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditCryptoHkdfParamSafety detects insecure legacy sha1 digest in HKDF', () => {
  const code = `
const key = crypto.hkdfSync('sha1', ikm, salt, info, 32);
`
  const result = auditCryptoHkdfParamSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.hkdfProof, 'INSECURE_HKDF_DIGEST_VULNERABILITY')
  assert.equal(result.violationsCount, 1)
})
