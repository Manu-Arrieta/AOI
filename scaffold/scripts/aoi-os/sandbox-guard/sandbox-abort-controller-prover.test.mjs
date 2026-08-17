import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxAbortControllerSafety } from './sandbox-abort-controller-prover.mjs'

test('proveSandboxAbortControllerSafety approves async worker with signal.throwIfAborted()', () => {
  const code = `
async function executeWorkerJob(jobData, signal) {
  signal.throwIfAborted();
  const res = await doHeavyCompute(jobData);
  signal.throwIfAborted();
  return res;
}
`
  const result = proveSandboxAbortControllerSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.abortProof, 'RESPONSIVE_ABORT_CONTROLLER_CANCELLATION_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxAbortControllerSafety detects un-cancelable async task without AbortSignal', () => {
  const code = `
async function executeWorkerJob(jobData) {
  const res = await doHeavyCompute(jobData);
  return res;
}
`
  const result = proveSandboxAbortControllerSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.abortProof, 'ORPHAN_ASYNC_TASK_CANCELLATION_RISK')
  assert.equal(result.violationsCount, 1)
})
