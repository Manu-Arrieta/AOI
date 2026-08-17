import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadBarrelDuplicates } from './dead-barrel-duplicate-pruner.mjs'

test('auditDeadBarrelDuplicates approves clean deduplicated barrel exports', () => {
  const code = `
export { parseTaskDag } from './dag-parser.mjs';
export { validateDagStructure, computeExecutionBatches } from './dag-scheduler.mjs';
`
  const result = auditDeadBarrelDuplicates(code)
  assert.equal(result.clean, true)
  assert.equal(result.barrelProof, 'BARREL_EXPORTS_DEDUPLICATED')
  assert.equal(result.duplicateCount, 0)
})

test('auditDeadBarrelDuplicates detects duplicate re-exported symbol', () => {
  const code = `
export { parseTaskDag, validateDagStructure } from './dag-parser.mjs';
export { validateDagStructure, computeExecutionBatches } from './dag-scheduler.mjs';
`
  const result = auditDeadBarrelDuplicates(code)
  assert.equal(result.clean, false)
  assert.equal(result.barrelProof, 'DUPLICATE_BARREL_EXPORTS_DETECTED')
  assert.equal(result.duplicateCount, 1)
  assert.equal(result.duplicateExports[0].symbol, 'validateDagStructure')
})
