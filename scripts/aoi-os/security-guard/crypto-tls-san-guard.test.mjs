import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoTlsSanSafety } from './crypto-tls-san-guard.mjs'

test('auditCryptoTlsSanSafety approves TLS checkServerIdentity using SAN/checkHost', () => {
  const code = `
const socket = tls.connect(443, 'api.example.com', {
  checkServerIdentity: (host, cert) => {
    if (cert.subjectaltname && cert.subjectaltname.includes(host)) {
      return undefined;
    }
    return tls.checkServerIdentity(host, cert);
  },
});
`
  const result = auditCryptoTlsSanSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.tlsSanProof, 'TLS_SAN_RFC6125_VERIFIED')
  assert.equal(result.violationsCount, 0)
})

test('auditCryptoTlsSanSafety detects legacy CN-only matching in checkServerIdentity', () => {
  const code = `
const socket = tls.connect(443, 'api.example.com', {
  checkServerIdentity: (host, cert) => {
    if (cert.subject.CN === host) {
      return undefined;
    }
    return new Error('Host mismatch');
  },
});
`
  const result = auditCryptoTlsSanSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.tlsSanProof, 'DEPRECATED_CN_MATCHING_RISK')
  assert.equal(result.violationsCount, 1)
})
