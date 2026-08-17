import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxLdPreloadSafety } from './sandbox-ld-preload-prover.mjs'

test('proveSandboxLdPreloadSafety approves clean environment without dynamic linker injection', () => {
  const code = `
const env = {
  ...process.env,
  PATH: '/usr/bin:/bin',
};
`
  const result = proveSandboxLdPreloadSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.linkerProof, 'SANITIZED_DYNAMIC_LINKER_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxLdPreloadSafety detects unsafe LD_PRELOAD injection', () => {
  const code = `
const env = {
  ...process.env,
  LD_PRELOAD: '/tmp/libhack.so',
};
`
  const result = proveSandboxLdPreloadSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.linkerProof, 'INSECURE_LINKER_PRELOAD_RISK')
  assert.equal(result.violationsCount, 1)
})
