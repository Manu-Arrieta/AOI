import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoEcCurveSafety } from './crypto-ec-curve-guard.mjs'

test('auditCryptoEcCurveSafety approves modern prime256v1 curve', () => {
  const code = `
function createServerECDH() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return ecdh;
}
`
  const result = auditCryptoEcCurveSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.curveProof, 'ROBUST_ELLIPTIC_CURVE_HARDNESS_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditCryptoEcCurveSafety detects insecure legacy secp112r1 curve', () => {
  const code = `
function createServerECDH() {
  const ecdh = crypto.createECDH('secp112r1');
  ecdh.generateKeys();
  return ecdh;
}
`
  const result = auditCryptoEcCurveSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.curveProof, 'WEAK_CRYPTOGRAPHIC_CURVE_DETECTED')
  assert.equal(result.violationsCount, 1)
})
