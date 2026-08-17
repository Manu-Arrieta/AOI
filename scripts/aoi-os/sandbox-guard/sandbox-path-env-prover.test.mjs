import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxPathEnvSafety } from './sandbox-path-env-prover.mjs'

test('proveSandboxPathEnvSafety approves secure canonical PATH environment', () => {
  const code = `
const env = {
  ...process.env,
  PATH: '/usr/local/bin:/usr/bin:/bin',
};
`
  const result = proveSandboxPathEnvSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.pathProof, 'CANONICAL_TRUSTED_PATH_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxPathEnvSafety detects insecure relative dot entry in PATH', () => {
  const code = `
const env = {
  ...process.env,
  PATH: '.:/usr/bin:/bin',
};
`
  const result = proveSandboxPathEnvSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.pathProof, 'INSECURE_SANDBOX_PATH_HIJACK_RISK')
  assert.equal(result.violationsCount, 1)
})
