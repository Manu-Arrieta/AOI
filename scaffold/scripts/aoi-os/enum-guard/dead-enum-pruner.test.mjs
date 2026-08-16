import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadEnums } from './dead-enum-pruner.mjs'

test('auditDeadEnums approves fully referenced enums and constants', () => {
  const enums = ['TaskStatus', 'UserRole']
  const code = `
const status = TaskStatus.IN_PROGRESS;
function assign(role: UserRole) {}
`
  const result = auditDeadEnums(enums, code)
  assert.equal(result.allReferenced, true)
  assert.equal(result.enumProof, 'ALL_EXPORTED_ENUMS_REFERENCED')
  assert.equal(result.deadEnumsCount, 0)
})

test('auditDeadEnums detects unreferenced dead enums', () => {
  const enums = ['TaskStatus', 'LegacyPriority']
  const code = `
const status = TaskStatus.COMPLETED;
`
  const result = auditDeadEnums(enums, code)
  assert.equal(result.allReferenced, false)
  assert.equal(result.enumProof, 'DEAD_UNREFERENCED_ENUMS_DETECTED')
  assert.equal(result.deadEnumsCount, 1)
  assert.equal(result.deadEnums[0].enumName, 'LegacyPriority')
})
