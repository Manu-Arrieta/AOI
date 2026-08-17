import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxIpcUnrefSafety } from './sandbox-ipc-unref-prover.mjs'

test('proveSandboxIpcUnrefSafety approves detached process with explicit unref', () => {
  const code = `
function startBackgroundDaemon(scriptPath) {
  const child = spawn('node', [scriptPath], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return child.pid;
}
`
  const result = proveSandboxIpcUnrefSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.unrefProof, 'DETERMINISTIC_DETACHED_UNREF_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxIpcUnrefSafety detects detached child process missing unref call', () => {
  const code = `
function startBackgroundDaemon(scriptPath) {
  const child = spawn('node', [scriptPath], {
    detached: true,
    stdio: 'ignore',
  });
  return child.pid;
}
`
  const result = proveSandboxIpcUnrefSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.unrefProof, 'DETACHED_PROCESS_HANG_RISK')
  assert.equal(result.violationsCount, 1)
})
