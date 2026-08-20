import test from 'node:test'
import assert from 'node:assert/strict'
import { generateSyntheticDag, runDagStressBenchmark } from './dag-stress-benchmark.mjs'

test('generateSyntheticDag generates linear, diamond, and mesh topologies correctly', () => {
  const linear = generateSyntheticDag(10, 'linear')
  assert.equal(linear.length, 10)
  assert.equal(linear[0].dependsOn.length, 0)
  assert.equal(linear[1].dependsOn[0], 'TASK-1')

  const diamond = generateSyntheticDag(10, 'diamond')
  assert.equal(diamond.length, 10)
  assert.equal(diamond[0].dependsOn.length, 0)
  assert.equal(diamond[1].dependsOn[0], 'TASK-1')
  assert.equal(diamond[9].dependsOn.length, 8)

  const mesh = generateSyntheticDag(50, 'mesh')
  assert.equal(mesh.length, 50)
})

test('runDagStressBenchmark successfully schedules 100-node mesh without cycles', () => {
  const result = runDagStressBenchmark(100, 'mesh')
  assert.equal(result.nodeCount, 100)
  assert.equal(result.isAcyclic, true)
  assert.equal(result.stressProof, 'DAG_STRESS_CONVERGENCE_PROVED')
  assert.ok(result.durationMs < 500, `Benchmark took ${result.durationMs}ms, should be sub-500ms`)
  assert.ok(result.waveCount >= 5)
})
