import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxProcessSigkillGraceSafety } from './sandbox-process-posix-signal-sigkill-prover.mjs'

test('proveSandboxProcessSigkillGraceSafety approves tiered SIGTERM -> setTimeout -> SIGKILL teardown', () => {
  const code = `
child.kill('SIGTERM');
const timer = setTimeout(() => {
  if (!child.killed) {
    child.kill('SIGKILL');
  }
}, 5000);
`
  const result = proveSandboxProcessSigkillGraceSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.hasTieredTeardown, true)
  assert.equal(result.sigkillGraceProof, 'TIERED_SIGTERM_SIGKILL_GRACE_VERIFIED')
})

test('proveSandboxProcessSigkillGraceSafety detects raw abrupt SIGKILL without grace period', () => {
  const code = `
function terminateProcess(pid) {
  process.kill(pid, 'SIGKILL');
}
`
  const result = proveSandboxProcessSigkillGraceSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.sigkillGraceProof, 'ABRUPT_UNGUARDED_SIGKILL_DETECTED')
  assert.ok(result.violations.includes('IMMEDIATE_RAW_SIGKILL_WITHOUT_PRECEDING_SIGTERM_GRACE_TIMEOUT'))
})

test('proveSandboxProcessSigkillGraceSafety returns safe when no SIGKILL is used', () => {
  const code = `
child.kill('SIGTERM');
`
  const result = proveSandboxProcessSigkillGraceSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.sigkillGraceProof, 'NO_RAW_SIGKILL_OPERATION_DETECTED')
})
