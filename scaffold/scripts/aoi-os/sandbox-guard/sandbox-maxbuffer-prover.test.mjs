import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxMaxBufferSafety } from './sandbox-maxbuffer-prover.mjs'

test('proveSandboxMaxBufferSafety approves exec with explicit maxBuffer', () => {
  const code = `
function runCompiler(cmd) {
  return execSync(cmd, { maxBuffer: 20 * 1024 * 1024 });
}
`
  const result = proveSandboxMaxBufferSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.maxBufferProof, 'MAXBUFFER_OVERFLOW_PREVENTED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxMaxBufferSafety detects exec without maxBuffer configuration', () => {
  const code = `
function runCompiler(cmd) {
  return execSync(cmd);
}
`
  const result = proveSandboxMaxBufferSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.maxBufferProof, 'MAXBUFFER_OVERFLOW_RISK_DETECTED')
  assert.equal(result.violationsCount, 1)
})
