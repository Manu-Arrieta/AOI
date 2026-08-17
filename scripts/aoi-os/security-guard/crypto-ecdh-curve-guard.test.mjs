import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoEcdhCurveSafety } from './crypto-ecdh-curve-guard.mjs'

test('auditCryptoEcdhCurveSafety approves robust x25519 ECDH curve', () => {
  const code = `
const ecdh = crypto.createECDH('x25519');
ecdh.generateKeys();
const sharedSecret = ecdh.computeSecret(peerPublicKey);
`
  const result = auditCryptoEcdhCurveSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.ecdhProof, 'ECDH_CURVE_HARDNESS_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditCryptoEcdhCurveSafety detects weak secp112r1 ECDH curve', () => {
  const code = `
const ecdh = crypto.createECDH('secp112r1');
ecdh.generateKeys();
`
  const result = auditCryptoEcdhCurveSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.ecdhProof, 'WEAK_ECDH_CURVE_RISK_DETECTED')
  assert.equal(result.violationsCount, 1)
})
