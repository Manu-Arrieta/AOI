import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoX509CertSafety } from './crypto-x509-cert-guard.mjs'

test('auditCryptoX509CertSafety approves X509Certificate with explicit checkHost validation', () => {
  const code = `
const cert = new crypto.X509Certificate(certPem);
if (cert.checkHost('api.example.com')) {
  establishTlsTrust(cert);
}
`
  const result = auditCryptoX509CertSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.x509Proof, 'X509_CERTIFICATE_VALIDATED')
  assert.equal(result.violationsCount, 0)
})

test('auditCryptoX509CertSafety detects X509Certificate without explicit validation', () => {
  const code = `
const cert = new crypto.X509Certificate(certPem);
establishTlsTrust(cert);
`
  const result = auditCryptoX509CertSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.x509Proof, 'UNVERIFIED_X509_CERTIFICATE_RISK')
  assert.equal(result.violationsCount, 1)
})
