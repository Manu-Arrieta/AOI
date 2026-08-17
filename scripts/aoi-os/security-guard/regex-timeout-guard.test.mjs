import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDynamicRegexSafety } from './regex-timeout-guard.mjs'

test('auditDynamicRegexSafety approves escaped/bounded dynamic RegExp', () => {
  const code = `
function buildFilter(pattern) {
  const safePattern = pattern.slice(0, 100);
  return new RegExp(safePattern, 'i');
}
`
  const result = auditDynamicRegexSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.regexProof, 'DYNAMIC_REGEXP_LENGTH_BOUNDED')
  assert.equal(result.violationsCount, 0)
})

test('auditDynamicRegexSafety detects unbounded dynamic RegExp', () => {
  const code = `
function buildFilter(pattern) {
  return new RegExp(pattern, 'i');
}
`
  const result = auditDynamicRegexSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.regexProof, 'UNBOUNDED_DYNAMIC_REGEXP_DETECTED')
  assert.equal(result.violationsCount, 1)
})
