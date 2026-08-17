import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxIpcPayloadSafety } from './sandbox-ipc-payload-prover.mjs'

test('proveSandboxIpcPayloadSafety approves IPC send with byteLength validation', () => {
  const code = `
function dispatchIpcMessage(child, msg) {
  const payloadStr = JSON.stringify(msg);
  if (Buffer.byteLength(payloadStr) > 32 * 1024 * 1024) {
    throw new Error('IPC Payload exceeds max limit');
  }
  child.send(msg);
}
`
  const result = proveSandboxIpcPayloadSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.ipcPayloadProof, 'BOUNDED_IPC_MESSAGE_PAYLOAD_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxIpcPayloadSafety detects unbounded IPC send without bounds check', () => {
  const code = `
function dispatchIpcMessage(child, msg) {
  child.send(msg);
}
`
  const result = proveSandboxIpcPayloadSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.ipcPayloadProof, 'UNBOUNDED_IPC_MESSAGE_PAYLOAD_DETECTED')
  assert.equal(result.violationsCount, 1)
})
