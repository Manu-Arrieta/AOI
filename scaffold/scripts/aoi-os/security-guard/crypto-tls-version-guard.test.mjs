import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoTlsVersionSafety } from './crypto-tls-version-guard.mjs'

test('auditCryptoTlsVersionSafety approves HTTPS server with minVersion TLSv1.3', () => {
  const code = `
const server = https.createServer({
  key: privateKey,
  cert: certificate,
  minVersion: 'TLSv1.3',
});
`
  const result = auditCryptoTlsVersionSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.tlsProof, 'MODERN_TLS_MIN_VERSION_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditCryptoTlsVersionSafety detects insecure legacy TLSv1 protocol configuration', () => {
  const code = `
const server = https.createServer({
  key: privateKey,
  cert: certificate,
  minVersion: 'TLSv1.0',
});
`
  const result = auditCryptoTlsVersionSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.tlsProof, 'INSECURE_TLS_PROTOCOL_DOWNGRADE_RISK')
  assert.equal(result.violationsCount, 1)
})
