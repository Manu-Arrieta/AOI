import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoTlsSniSafety } from './crypto-tls-sni-guard.mjs'

test('auditCryptoTlsSniSafety approves TLS connection with explicit servername SNI', () => {
  const code = `
const socket = tls.connect({
  host: '192.168.1.10',
  port: 8443,
  servername: 'secure.api.internal',
});
`
  const result = auditCryptoTlsSniSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.tlsSniProof, 'TLS_SNI_RFC6066_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditCryptoTlsSniSafety detects TLS connect missing servername SNI', () => {
  const code = `
const socket = tls.connect(8443, '192.168.1.10');
`
  const result = auditCryptoTlsSniSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.tlsSniProof, 'TLS_SNI_OMITTED_ROUTING_RISK')
  assert.equal(result.violationsCount, 1)
})
