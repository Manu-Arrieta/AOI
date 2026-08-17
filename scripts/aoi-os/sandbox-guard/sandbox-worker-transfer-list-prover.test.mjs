import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxWorkerTransferListSafety } from './sandbox-worker-transfer-list-prover.mjs'

test('proveSandboxWorkerTransferListSafety approves Worker postMessage with transferList', () => {
  const code = `
parentPort.postMessage(buffer, [buffer]);
`
  const result = proveSandboxWorkerTransferListSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.transferProof, 'ZERO_COPY_TRANSFER_LIST_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxWorkerTransferListSafety detects Worker postMessage missing transferList', () => {
  const code = `
parentPort.postMessage(buffer);
`
  const result = proveSandboxWorkerTransferListSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.transferProof, 'STRUCTURED_CLONING_MEMORY_BLOAT_RISK')
  assert.equal(result.violationsCount, 1)
})
