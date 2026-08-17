import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxIpcDisconnectSafety } from './sandbox-ipc-disconnect-prover.mjs'

test('proveSandboxIpcDisconnectSafety approves forked process with explicit disconnect on exit', () => {
  const code = `
function spawnWorker(modulePath) {
  const child = fork(modulePath);
  child.on('message', (msg) => console.log(msg));

  function cleanup() {
    if (child.connected) {
      child.disconnect();
    }
  }
  return { child, cleanup };
}
`
  const result = proveSandboxIpcDisconnectSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.disconnectProof, 'DETERMINISTIC_IPC_DISCONNECT_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxIpcDisconnectSafety detects forked child process missing disconnect call', () => {
  const code = `
function spawnWorker(modulePath) {
  const child = fork(modulePath);
  child.on('message', (msg) => console.log(msg));
  return child;
}
`
  const result = proveSandboxIpcDisconnectSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.disconnectProof, 'UNDISCONNECTED_IPC_HANDLE_LEAK_RISK')
  assert.equal(result.violationsCount, 1)
})
