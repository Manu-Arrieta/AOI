import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxWorkerHeapLimitSafety } from './sandbox-worker-heap-limit-prover.mjs'

test('proveSandboxWorkerHeapLimitSafety approves Worker with 256MB resourceLimits', () => {
  const code = `
const worker = new Worker('./worker.js', {
  resourceLimits: {
    maxOldGenerationSizeMb: 256,
    maxYoungGenerationSizeMb: 64,
  },
});
`
  const result = proveSandboxWorkerHeapLimitSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.workerHeapProof, 'BOUNDED_WORKER_HEAP_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxWorkerHeapLimitSafety detects Worker missing resourceLimits', () => {
  const code = `
const worker = new Worker('./worker.js', {
  workerData: { taskId: 'T-1' },
});
`
  const result = proveSandboxWorkerHeapLimitSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.workerHeapProof, 'UNBOUNDED_WORKER_HEAP_RISK')
  assert.equal(result.violationsCount, 1)
})
