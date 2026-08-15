import test from 'node:test'
import assert from 'node:assert/strict'
import { compressDelta, applyDelta } from './delta-snapshot-compressor.mjs'

test('compressDelta and applyDelta round-trip state modifications with 100% fidelity', () => {
  const baseState = {
    'task:T-1': { status: 'in_progress', retries: 0 },
    'task:T-2': { status: 'pending' },
    'temp:var': 123,
  }

  const nextState = {
    'task:T-1': { status: 'completed', retries: 0 }, // modified
    'task:T-2': { status: 'pending' }, // unchanged
    'task:T-3': { status: 'in_progress' }, // added
    // temp:var deleted
  }

  const delta = compressDelta(baseState, nextState)
  assert.equal(delta.hasChanges, true)
  assert.deepEqual(delta.deleted, ['temp:var'])
  assert.deepEqual(delta.added, { 'task:T-3': { status: 'in_progress' } })
  assert.deepEqual(delta.modified, { 'task:T-1': { status: 'completed', retries: 0 } })

  const reconstructed = applyDelta(baseState, delta)
  assert.deepEqual(reconstructed, nextState)
})
