import test from 'node:test'
import assert from 'node:assert/strict'
import { auditPayloadDrift } from './payload-drift-guard.mjs'

test('auditPayloadDrift approves perfectly matched client and backend keys', () => {
  const clientKeys = ['userId', 'taskTitle']
  const backendKeys = ['userId', 'taskTitle']

  const result = auditPayloadDrift(clientKeys, backendKeys)
  assert.equal(result.aligned, true)
  assert.equal(result.driftProof, 'PAYLOAD_SCHEMA_100PCT_ALIGNED')
  assert.equal(result.missingKeys.length, 0)
})

test('auditPayloadDrift catches casing mismatches and missing required keys', () => {
  const clientKeys = ['user_id']
  const backendKeys = ['userId', 'taskTitle']

  const result = auditPayloadDrift(clientKeys, backendKeys)
  assert.equal(result.aligned, false)
  assert.equal(result.driftProof, 'PAYLOAD_DRIFT_OR_MISMATCH_DETECTED')
  assert.ok(result.casingMismatches.length > 0)
  assert.ok(result.missingKeys.includes('taskTitle'))
})
