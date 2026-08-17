import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxEnvIsolationSafety } from './sandbox-env-isolation-prover.mjs'

test('proveSandboxEnvIsolationSafety approves subprocess with explicit filtered env', () => {
  const code = `
function runTask(cmd) {
  return spawn(cmd, [], {
    env: { PATH: process.env.PATH, NODE_ENV: 'test' }
  });
}
`
  const result = proveSandboxEnvIsolationSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.isolationProof, 'SANDBOX_ENV_ISOLATION_PROVEN')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxEnvIsolationSafety detects subprocess with ambient env inheritance', () => {
  const code = `
function runTask(cmd) {
  return spawn(cmd, []);
}
`
  const result = proveSandboxEnvIsolationSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.isolationProof, 'UNISOLATED_HOST_ENV_DETECTED')
  assert.equal(result.violationsCount, 1)
})
