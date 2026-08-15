import test from 'node:test'
import assert from 'node:assert/strict'
import { auditSchemaSunset } from './schema-sunset-sentinel.mjs'

test('auditSchemaSunset approves code using only modern supported schema fields', () => {
  const code = `
export function getUserSummary(user: User) {
  return { id: user.id, displayName: user.fullName };
}
`
  const result = auditSchemaSunset(code, [{ name: 'legacyUsername', replacement: 'fullName' }])
  assert.equal(result.modern, true)
  assert.equal(result.sentinelProof, 'ALL_REFERENCED_FIELDS_ACTIVE_AND_MODERN')
  assert.equal(result.detectedCount, 0)
})

test('auditSchemaSunset detects references to deprecated legacy fields', () => {
  const code = `
export function getUserSummary(user: User) {
  return { id: user.id, username: user.legacyUsername };
}
`
  const result = auditSchemaSunset(code, [{ name: 'legacyUsername', replacement: 'fullName' }])
  assert.equal(result.modern, false)
  assert.equal(result.sentinelProof, 'SUNSET_DEPRECATED_FIELDS_DETECTED')
  assert.equal(result.detectedCount, 1)
  assert.equal(result.detectedDeprecations[0].field, 'legacyUsername')
})
