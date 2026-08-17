import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxStdinClosureSafety } from './sandbox-stdin-close-prover.mjs'

test('proveSandboxStdinClosureSafety approves process runner calling stdin.end()', () => {
  const code = `
function sendPayloadToWorker(child, payload) {
  child.stdin.write(JSON.stringify(payload));
  child.stdin.end();
}
`
  const result = proveSandboxStdinClosureSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.stdinProof, 'DETERMINISTIC_STDIN_EOF_CLOSURE_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxStdinClosureSafety detects unclosed stdin stream hanging risk', () => {
  const code = `
function sendPayloadToWorker(child, payload) {
  child.stdin.write(JSON.stringify(payload));
}
`
  const result = proveSandboxStdinClosureSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.stdinProof, 'UNCLOSED_STDIN_STREAM_HANG_RISK')
  assert.equal(result.violationsCount, 1)
})
