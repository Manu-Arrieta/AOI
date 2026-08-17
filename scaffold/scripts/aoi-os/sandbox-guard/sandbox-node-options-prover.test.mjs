import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxNodeOptionsSafety } from './sandbox-node-options-prover.mjs'

test('proveSandboxNodeOptionsSafety approves clean environment without dangerous NODE_OPTIONS', () => {
  const code = `
const env = {
  ...process.env,
  NODE_OPTIONS: '--max-old-space-size=512',
};
`
  const result = proveSandboxNodeOptionsSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.nodeOptionsProof, 'SANITIZED_NODE_OPTIONS_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxNodeOptionsSafety detects dangerous --require flag in NODE_OPTIONS', () => {
  const code = `
const env = {
  ...process.env,
  NODE_OPTIONS: '--require /tmp/malicious.js',
};
`
  const result = proveSandboxNodeOptionsSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.nodeOptionsProof, 'INSECURE_NODE_OPTIONS_ESCAPE_RISK')
  assert.equal(result.violationsCount, 1)
})
