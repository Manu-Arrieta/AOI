import test from 'node:test'
import assert from 'node:assert/strict'
import { auditWorkerTerminationSafety } from './worker-termination-guard.mjs'

test('auditWorkerTerminationSafety approves worker with terminate inside afterAll', () => {
  const code = `
const worker = new Worker('./task-worker.js');
afterAll(async () => {
  await worker.terminate();
});
`
  const result = auditWorkerTerminationSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.workerProof, 'WORKER_TERMINATION_GUARANTEED')
  assert.equal(result.violationsCount, 0)
})

test('auditWorkerTerminationSafety detects worker missing terminate call', () => {
  const code = `
const worker = new Worker('./task-worker.js');
worker.postMessage({ type: 'PROCESS' });
`
  const result = auditWorkerTerminationSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.workerProof, 'UNTERMINATED_WORKER_DETECTED')
  assert.equal(result.violationsCount, 1)
})
