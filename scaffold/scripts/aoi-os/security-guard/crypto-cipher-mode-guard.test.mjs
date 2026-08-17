import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoCipherModeSafety } from './crypto-cipher-mode-guard.mjs'

test('auditCryptoCipherModeSafety approves AES-256-GCM with authTag verification', () => {
  const code = `
function encryptPayload(data, key, iv) {
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { enc, tag };
}
`
  const result = auditCryptoCipherModeSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.cipherProof, 'AUTHENTICATED_AEAD_CIPHER_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditCryptoCipherModeSafety detects insecure AES-256-CBC mode', () => {
  const code = `
function encryptPayload(data, key, iv) {
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}
`
  const result = auditCryptoCipherModeSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.cipherProof, 'INSECURE_CIPHER_MODE_DETECTED')
  assert.equal(result.violationsCount, 1)
  assert.equal(result.violations[0].type, 'UNAUTHENTICATED_CIPHER_MODE')
})
