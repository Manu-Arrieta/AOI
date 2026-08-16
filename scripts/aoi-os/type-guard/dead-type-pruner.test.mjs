import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTypes } from './dead-type-pruner.mjs'

test('auditDeadTypes approves fully referenced types and interfaces', () => {
  const types = ['TaskState', 'UserSession']
  const code = `
import type { TaskState } from './types';
export function getSession(): UserSession {
  return {};
}
`
  const result = auditDeadTypes(types, code)
  assert.equal(result.allReferenced, true)
  assert.equal(result.typeProof, 'ALL_EXPORTED_TYPES_REFERENCED')
  assert.equal(result.deadTypesCount, 0)
})

test('auditDeadTypes detects unreferenced dead types', () => {
  const types = ['TaskState', 'LegacyReportDTO']
  const code = `
import type { TaskState } from './types';
`
  const result = auditDeadTypes(types, code)
  assert.equal(result.allReferenced, false)
  assert.equal(result.typeProof, 'DEAD_UNREFERENCED_TYPES_DETECTED')
  assert.equal(result.deadTypesCount, 1)
  assert.equal(result.deadTypes[0].type, 'LegacyReportDTO')
})
