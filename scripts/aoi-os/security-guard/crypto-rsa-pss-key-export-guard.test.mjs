import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoRsaPssKeyExportSafety } from './crypto-rsa-pss-key-export-guard.mjs'

test('auditCryptoRsaPssKeyExportSafety approves PKCS#8 private key export', () => {
  const code = `
const exportedKey = privateKey.export({
  type: 'pkcs8',
  format: 'pem',
  cipher: 'aes-256-gcm',
  passphrase: 'secure-secret-password',
});
`
  const result = auditCryptoRsaPssKeyExportSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.hasPkcs8, true)
  assert.equal(result.rsaPssKeyExportProof, 'SECURE_PKCS8_KEY_EXPORT_VERIFIED')
})

test('auditCryptoRsaPssKeyExportSafety detects legacy PKCS#1 private key export', () => {
  const code = `
const exportedKey = privateKey.export({
  type: 'pkcs1',
  format: 'pem',
});
`
  const result = auditCryptoRsaPssKeyExportSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.rsaPssKeyExportProof, 'INSECURE_OR_LEGACY_KEY_EXPORT_FORMAT_DETECTED')
  assert.ok(result.violations[0].includes('INSECURE_KEY_EXPORT_FORMAT'))
})

test('auditCryptoRsaPssKeyExportSafety returns safe when no key export operation is present', () => {
  const code = `
const data = "crypto-safe-string";
`
  const result = auditCryptoRsaPssKeyExportSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.rsaPssKeyExportProof, 'NO_KEY_EXPORT_OPERATION_DETECTED')
})
