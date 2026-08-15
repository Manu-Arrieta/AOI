import test from 'node:test'
import assert from 'node:assert/strict'
import { createTimeTravelEngine } from './time-travel-engine.mjs'

test('createTimeTravelEngine captures cryptographic snapshots and supports clean rollbacks', () => {
  const engine = createTimeTravelEngine()

  // Capture Wave 1 snapshot
  const snap1 = engine.captureSnapshot(1, { activeTasks: ['T-1'], status: 'completed' })
  assert.equal(snap1.waveNumber, 1)
  assert.ok(snap1.snapshotHash.length === 64)

  // Capture Wave 2 snapshot
  const snap2 = engine.captureSnapshot(2, { activeTasks: ['T-2'], status: 'completed' })
  assert.equal(snap2.waveNumber, 2)
  assert.equal(engine.getSnapshots().length, 2)

  // Rollback to Wave 1
  const rollback = engine.rollbackToWave(1)
  assert.equal(rollback.success, true)
  assert.equal(rollback.rolledBackCount, 1)
  assert.equal(rollback.restoredSnapshot.waveNumber, 1)
  assert.equal(engine.getSnapshots().length, 1)
})
