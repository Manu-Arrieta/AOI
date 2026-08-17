import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoTlsOcspSafety } from './crypto-tls-ocsp-guard.mjs'

test('auditCryptoTlsOcspSafety approves TLS connection with requestOCSP and OCSPResponse handler', () => {
  const code = `
const socket = tls.connect({
  host: 'secure.auth.internal',
  port: 8443,
  requestOCSP: true,
});

socket.on('OCSPResponse', (response) => {
  verifyOcspResponse(response);
});
`
  const result = auditCryptoTlsOcspSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.tlsOcspProof, 'TLS_OCSP_STAPLING_VERIFIED')
  assert.equal(result.violationsCount, 0)
})

test('auditCryptoTlsOcspSafety detects requestOCSP missing OCSPResponse listener', () => {
  const code = `
const socket = tls.connect({
  host: 'secure.auth.internal',
  port: 8443,
  requestOCSP: true,
});
`
  const result = auditCryptoTlsOcspSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.tlsOcspProof, 'OCSP_RESPONSE_UNHANDLED_RISK')
  assert.equal(result.violationsCount, 1)
})
