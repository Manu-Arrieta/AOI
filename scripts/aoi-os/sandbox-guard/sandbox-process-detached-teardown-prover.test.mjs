import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxProcessDetachedTeardownSafety } from './sandbox-process-detached-teardown-prover.mjs'

test('proveSandboxProcessDetachedTeardownSafety approves detached process with negative PID group kill', () => {
  const code = `
const child = spawn('daemon.exe', [], {
  detached: true,
  stdio: 'ignore',
});

function cleanup() {
  process.kill(-child.pid, 'SIGTERM');
}
`
  const result = proveSandboxProcessDetachedTeardownSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.detachedTeardownProof, 'DETACHED_PROCESS_GROUP_TEARDOWN_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxProcessDetachedTeardownSafety detects detached process missing process group kill', () => {
  const code = `
const child = spawn('daemon.exe', [], {
  detached: true,
  stdio: 'ignore',
});

function cleanup() {
  child.kill(); // Only kills parent, leaves sub-daemons orphan
}
`
  const result = proveSandboxProcessDetachedTeardownSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.detachedTeardownProof, 'ORPHAN_DETACHED_PROCESS_RISK')
  assert.equal(result.violationsCount, 1)
})
