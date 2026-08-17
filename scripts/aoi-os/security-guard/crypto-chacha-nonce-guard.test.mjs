import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoChachaNonceSafety } from './crypto-chacha-nonce-guard.mjs'

test('auditCryptoChachaNonceSafety approves ChaCha20-Poly1305 with 12-byte nonce and getAuthTag', () => {
  const code = `
const cipher = crypto.createCipheriv('chacha20-poly1305', key, iv, { authTagLength: 16 });
const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
const tag = cipher.getAuthTag();
`
  const result = auditCryptoChachaNonceSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.chachaProof, 'CHACHA20_POLY1305_AEAD_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditCryptoChachaNonceSafety detects missing auth tag handling in ChaCha20-Poly1305', () => {
  const code = `
const cipher = crypto.createCipheriv('chacha20-poly1305', key, iv);
const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
`
  const result = auditCryptoChachaNonceSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.chachaProof, 'INSECURE_CHACHA20_PARAMETERS_DETECTED')
  assert.equal(result.violationsCount, 1)
})
