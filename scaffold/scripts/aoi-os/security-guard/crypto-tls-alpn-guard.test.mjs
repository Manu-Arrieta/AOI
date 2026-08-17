import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoTlsAlpnSafety } from './crypto-tls-alpn-guard.mjs'

test('auditCryptoTlsAlpnSafety approves TLS configuration with standard ALPN protocols', () => {
  const code = `
const server = tls.createServer({
  key: privateKey,
  cert: certificate,
  ALPNProtocols: ['h2', 'http/1.1'],
});
`
  const result = auditCryptoTlsAlpnSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.tlsAlpnProof, 'TLS_ALPN_IANA_COMPLIANT')
  assert.equal(result.violationsCount, 0)
})

test('auditCryptoTlsAlpnSafety detects non-standard ALPN protocol strings', () => {
  const code = `
const client = tls.connect({
  host: 'api.server.internal',
  port: 8443,
  ALPNProtocols: ['custom-binary-proto'],
});
`
  const result = auditCryptoTlsAlpnSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.tlsAlpnProof, 'TLS_ALPN_NON_STANDARD_RISK')
  assert.equal(result.violationsCount, 1)
})
