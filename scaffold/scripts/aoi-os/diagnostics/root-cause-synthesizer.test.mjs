import test from 'node:test'
import assert from 'node:assert/strict'
import { diagnoseRootCause } from './root-cause-synthesizer.mjs'

test('diagnoseRootCause classifies AssertionError into ASSERTION_VALUE_MISMATCH', () => {
  const err = 'AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 1 !== 2'
  const stack = 'at TestContext.<anonymous> (file:///test.mjs:10:1)'
  const diag = diagnoseRootCause(err, stack)
  assert.equal(diag.archetype, 'ASSERTION_VALUE_MISMATCH')
  assert.equal(diag.confidence, 'HIGH')
  assert.ok(diag.suggestedRemediation.includes('Align expected return value'))
})

test('diagnoseRootCause classifies null reference into NULL_POINTER_OR_UNDEFINED_DEREFERENCE', () => {
  const err = 'TypeError: Cannot read properties of undefined (reading "title")'
  const diag = diagnoseRootCause(err)
  assert.equal(diag.archetype, 'NULL_POINTER_OR_UNDEFINED_DEREFERENCE')
  assert.ok(diag.suggestedRemediation.includes('optional chaining'))
})
