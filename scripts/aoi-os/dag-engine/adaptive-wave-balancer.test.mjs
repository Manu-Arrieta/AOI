import test from 'node:test'
import assert from 'node:assert/strict'
import { balanceWaveTasks } from './adaptive-wave-balancer.mjs'

test('balanceWaveTasks distributes tasks evenly across worker partitions', () => {
  const tasks = [
    { id: 'T-1', weight: 40 },
    { id: 'T-2', weight: 30 },
    { id: 'T-3', weight: 20 },
    { id: 'T-4', weight: 10 },
  ]

  const result = balanceWaveTasks(tasks, 2)
  assert.equal(result.workerCount, 2)
  assert.equal(result.partitions.length, 2)
  assert.equal(result.partitionWeights[0], 50) // 40 + 10
  assert.equal(result.partitionWeights[1], 50) // 30 + 20
  assert.equal(result.balanceEfficiency, 100)
})

test('balanceWaveTasks handles empty task lists gracefully', () => {
  const result = balanceWaveTasks([], 3)
  assert.equal(result.workerCount, 3)
  assert.equal(result.balanceEfficiency, 100)
})
