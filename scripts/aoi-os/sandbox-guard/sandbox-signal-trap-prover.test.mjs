import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxSignalTrapSafety } from './sandbox-signal-trap-prover.mjs'

test('proveSandboxSignalTrapSafety approves detached process spawner with negative PID kill trap', () => {
  const code = `
function launchIsolatedProcess(cmd, args) {
  const child = spawn(cmd, args, { detached: true });
  process.on('SIGTERM', () => {
    try { process.kill(-child.pid, 'SIGKILL'); } catch (e) {}
  });
  return child;
}
`
  const result = proveSandboxSignalTrapSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.groupSignalProof, 'PROCESS_GROUP_SIGNAL_TRAP_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxSignalTrapSafety detects process spawner missing detached group kill', () => {
  const code = `
function launchIsolatedProcess(cmd, args) {
  const child = spawn(cmd, args);
  return child;
}
`
  const result = proveSandboxSignalTrapSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.groupSignalProof, 'ORPHAN_PROCESS_TREE_RISK_DETECTED')
  assert.equal(result.violationsCount, 1)
})
