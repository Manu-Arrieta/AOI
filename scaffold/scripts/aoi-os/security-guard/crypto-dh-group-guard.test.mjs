import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoDhGroupSafety } from './crypto-dh-group-guard.mjs'

test('auditCryptoDhGroupSafety approves Diffie-Hellman with modp14 group', () => {
  const code = `
const dh = crypto.getDiffieHellman('modp14');
dh.generateKeys();
`
  const result = auditCryptoDhGroupSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.dhProof, 'ROBUST_DH_GROUP_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditCryptoDhGroupSafety detects insecure legacy 512-bit DH group', () => {
  const code = `
const dh = crypto.createDiffieHellman(512);
dh.generateKeys();
`
  const result = auditCryptoDhGroupSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.dhProof, 'INSECURE_DH_GROUP_VULNERABILITY')
  assert.equal(result.violationsCount, 1)
})
