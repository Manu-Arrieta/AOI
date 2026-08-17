import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoTlsRenegotiationSafety } from './crypto-tls-renegotiation-guard.mjs'

test('auditCryptoTlsRenegotiationSafety approves TLS server with TLSv1.3 minVersion', () => {
  const code = `
const server = tls.createServer({
  key: privateKey,
  cert: certificate,
  minVersion: 'TLSv1.3',
});
`
  const result = auditCryptoTlsRenegotiationSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.tlsRenegotiationProof, 'TLS_RENEGOTIATION_DEFENSE_VERIFIED')
  assert.equal(result.violationsCount, 0)
})

test('auditCryptoTlsRenegotiationSafety detects legacy TLSv1.2 without renegotiation mitigation', () => {
  const code = `
const server = tls.createServer({
  key: privateKey,
  cert: certificate,
  minVersion: 'TLSv1.2',
});
`
  const result = auditCryptoTlsRenegotiationSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.tlsRenegotiationProof, 'TLS_RENEGOTIATION_DOS_EXPOSURE_RISK')
  assert.equal(result.violationsCount, 1)
})
