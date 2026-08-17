import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxFdIsolationSafety } from './sandbox-fd-cloexec-prover.mjs'

test('proveSandboxFdIsolationSafety approves spawn with isolated stdio array', () => {
  const code = `
function launchSandboxProcess(cmd, args) {
  return spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
}
`
  const result = proveSandboxFdIsolationSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.fdProof, 'SANDBOX_FD_ISOLATION_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxFdIsolationSafety detects spawn without stdio confinement', () => {
  const code = `
function launchSandboxProcess(cmd, args) {
  return spawn(cmd, args, { cwd: '/sandbox' });
}
`
  const result = proveSandboxFdIsolationSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.fdProof, 'UNCONFINED_FD_INHERITANCE_RISK')
  assert.equal(result.violationsCount, 1)
})
