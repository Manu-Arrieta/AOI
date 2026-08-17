import test from 'node:test'
import assert from 'node:assert/strict'
import { proveShmChannelCleanupSafety } from './sandbox-shm-cleanup-prover.mjs'

test('proveShmChannelCleanupSafety approves MessageChannel with port close in afterAll', () => {
  const code = `
const { port1, port2 } = new MessageChannel();
afterAll(() => {
  port1.close();
  port2.close();
});
`
  const result = proveShmChannelCleanupSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.shmProof, 'IPC_CHANNEL_CLEANUP_GUARANTEED')
  assert.equal(result.violationsCount, 0)
})

test('proveShmChannelCleanupSafety detects MessageChannel missing port close teardown', () => {
  const code = `
const channel = new MessageChannel();
channel.port1.onmessage = (e) => {};
`
  const result = proveShmChannelCleanupSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.shmProof, 'UNCLOSED_IPC_CHANNEL_DETECTED')
  assert.equal(result.violationsCount, 1)
})
