import test from 'node:test'
import assert from 'node:assert/strict'
import { auditNullabilitySafety } from './nullability-contract-guard.mjs'

test('auditNullabilitySafety proves null safety when optional chaining is used', () => {
  const safeCode = `
export function formatStreet(user: User) {
  return user.address?.street ?? 'N/A';
}
`
  const result = auditNullabilitySafety(safeCode, ['address'])
  assert.equal(result.safe, true)
  assert.equal(result.nullabilityProof, 'STRICT_NULL_SAFETY_PROVEN')
  assert.equal(result.violationsCount, 0)
})

test('auditNullabilitySafety detects unsafe direct dereference on optional fields', () => {
  const unsafeCode = `
export function formatStreet(user: User) {
  return user.address.street; // Unsafe: address is optional
}
`
  const result = auditNullabilitySafety(unsafeCode, ['address'])
  assert.equal(result.safe, false)
  assert.equal(result.nullabilityProof, 'NULLABLE_DEREFERENCE_VIOLATION')
  assert.equal(result.violationsCount, 1)
  assert.equal(result.violations[0].field, 'address')
})
