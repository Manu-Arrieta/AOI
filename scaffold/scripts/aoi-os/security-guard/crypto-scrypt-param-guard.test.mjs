import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoScryptParamSafety } from './crypto-scrypt-param-guard.mjs'

test('auditCryptoScryptParamSafety approves Scrypt with N=16384', () => {
  const code = `
const key = crypto.scryptSync(password, salt, 64, {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
});
`
  const result = auditCryptoScryptParamSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.scryptProof, 'ROBUST_SCRYPT_PARAMETERS_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditCryptoScryptParamSafety detects insecure weak Scrypt cost parameter N=1024', () => {
  const code = `
const key = crypto.scryptSync(password, salt, 32, {
  N: 1024,
  r: 8,
  p: 1,
});
`
  const result = auditCryptoScryptParamSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.scryptProof, 'WEAK_SCRYPT_COST_VULNERABILITY')
  assert.equal(result.violationsCount, 1)
})
