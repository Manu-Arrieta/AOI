import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxRLimitSafety } from './sandbox-rlimit-prover.mjs'

test('proveSandboxRLimitSafety approves subprocess with ulimit CPU bound', () => {
  const code = `
function launchTask(cmd) {
  return exec(\`ulimit -t 30 && \${cmd}\`);
}
`
  const result = proveSandboxRLimitSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.rlimitProof, 'SANDBOX_RLIMIT_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxRLimitSafety detects subprocess without CPU or timeout limit', () => {
  const code = `
function launchTask(cmd) {
  return exec(cmd);
}
`
  const result = proveSandboxRLimitSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.rlimitProof, 'UNBOUNDED_PROCESS_RESOURCES_DETECTED')
  assert.equal(result.violationsCount, 1)
})
