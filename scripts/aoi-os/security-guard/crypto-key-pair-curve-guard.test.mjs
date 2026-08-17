import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoKeyPairSafety } from './crypto-key-pair-curve-guard.mjs'

test('auditCryptoKeyPairSafety approves ed25519 and 2048-bit RSA key pair generation', () => {
  const code = `
crypto.generateKeyPair('ed25519', (err, pub, priv) => {});
crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
`
  const result = auditCryptoKeyPairSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.keyPairProof, 'KEYPAIR_PARAMETERS_CANONICAL')
  assert.equal(result.violationsCount, 0)
})

test('auditCryptoKeyPairSafety detects weak curve in key pair generation', () => {
  const code = `
crypto.generateKeyPair('ec', { namedCurve: 'secp112r1' }, (err, pub, priv) => {});
`
  const result = auditCryptoKeyPairSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.keyPairProof, 'INSECURE_KEYPAIR_PARAMETERS_DETECTED')
  assert.equal(result.violationsCount, 1)
})
