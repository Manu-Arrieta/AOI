import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoDecipherAuthTagSafety } from './crypto-decipher-authtag-guard.mjs'

test('auditCryptoDecipherAuthTagSafety approves AEAD decipher with setAuthTag before final', () => {
  const code = `
const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(authTag);
let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
decrypted += decipher.final('utf8');
`
  const result = auditCryptoDecipherAuthTagSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.authTagOrderProof, 'AEAD_DECIPHER_AUTH_TAG_ORDER_VERIFIED')
  assert.equal(result.violationsCount, 0)
})

test('auditCryptoDecipherAuthTagSafety detects AEAD decipher missing setAuthTag', () => {
  const code = `
const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
decrypted += decipher.final('utf8');
`
  const result = auditCryptoDecipherAuthTagSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.authTagOrderProof, 'OUT_OF_ORDER_AUTH_TAG_RISK')
  assert.equal(result.violationsCount, 1)
})

test('auditCryptoDecipherAuthTagSafety detects AEAD decipher with setAuthTag called after final', () => {
  const code = `
const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
decrypted += decipher.final('utf8');
decipher.setAuthTag(authTag);
`
  const result = auditCryptoDecipherAuthTagSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.authTagOrderProof, 'OUT_OF_ORDER_AUTH_TAG_RISK')
  assert.equal(result.violationsCount, 1)
})
