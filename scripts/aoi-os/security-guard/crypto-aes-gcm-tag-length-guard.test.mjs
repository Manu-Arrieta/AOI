import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoAesGcmTagLengthSafety } from './crypto-aes-gcm-tag-length-guard.mjs'

test('auditCryptoAesGcmTagLengthSafety approves explicit authTagLength: 16', () => {
  const code = `
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
`
  const result = auditCryptoAesGcmTagLengthSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.aesGcmTagLengthProof, 'STRICT_16_BYTE_AES_GCM_AUTHTAG_VERIFIED')
})

test('auditCryptoAesGcmTagLengthSafety detects truncated authTagLength < 16', () => {
  const code = `
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: 8 });
`
  const result = auditCryptoAesGcmTagLengthSafety(code)
  assert.equal(result.safe, false)
  assert.ok(result.violations.includes('INSECURE_TRUNCATED_AES_GCM_AUTHTAG_LENGTH_SPECIFIED'))
})

test('auditCryptoAesGcmTagLengthSafety flags missing explicit 16-byte tag length verification', () => {
  const code = `
const decipher = crypto.createDecipheriv('aes-128-gcm', key, iv);
`
  const result = auditCryptoAesGcmTagLengthSafety(code)
  assert.equal(result.safe, false)
  assert.ok(result.violations.includes('MISSING_EXPLICIT_16_BYTE_AUTHTAG_LENGTH_IN_AES_GCM'))
})
