import test from 'node:test'
import assert from 'node:assert/strict'
import { createSpeculativePipeline } from './speculative-wave-pipeline.mjs'

test('createSpeculativePipeline stages, promotes, and discards waves cleanly in memory', () => {
  const pipeline = createSpeculativePipeline()

  // 1. Stage wave 2 speculatively
  const stageRes = pipeline.stageSpeculativeWave(2, [
    { id: 'T-3', role: 'backend', title: 'Task 3' },
    { id: 'T-4', role: 'frontend', title: 'Task 4' },
  ])
  assert.equal(stageRes.stagedCount, 2)
  assert.equal(pipeline.hasStagedWave(2), true)

  // 2. Promote wave 2 on wave 1 success
  const promoRes = pipeline.promoteSpeculativeWave(2)
  assert.equal(promoRes.promotedCount, 2)
  assert.equal(promoRes.status, 'SPECULATIVE_WAVE_PROMOTED_ZERO_LATENCY')
  assert.equal(pipeline.hasStagedWave(2), false)

  // 3. Stage and discard wave 3
  pipeline.stageSpeculativeWave(3, [{ id: 'T-5', role: 'devops', title: 'Task 5' }])
  const discardRes = pipeline.discardSpeculativeWave(3)
  assert.equal(discardRes.discarded, true)
  assert.equal(pipeline.hasStagedWave(3), false)
})
