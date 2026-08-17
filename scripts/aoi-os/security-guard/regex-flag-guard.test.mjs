import test from 'node:test'
import assert from 'node:assert/strict'
import { auditRegexUnicodeSafety } from './regex-flag-guard.mjs'

test('auditRegexUnicodeSafety approves Unicode regex with u flag', () => {
  const code = `
function validateUsername(name) {
  return /^[\\p{Letter}\\p{Number}_]+$/u.test(name);
}
`
  const result = auditRegexUnicodeSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.unicodeProof, 'UNICODE_REGEX_SAFETY_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditRegexUnicodeSafety detects Unicode property escape without u flag', () => {
  const code = `
function validateUsername(name) {
  return /^[\\p{Letter}]+$/.test(name);
}
`
  const result = auditRegexUnicodeSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.unicodeProof, 'NON_UNICODE_REGEX_RISK_DETECTED')
  assert.equal(result.violationsCount, 1)
})
