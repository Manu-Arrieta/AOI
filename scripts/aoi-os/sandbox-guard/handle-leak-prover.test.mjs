import test from 'node:test'
import assert from 'node:assert/strict'
import { proveHandleSafety } from './handle-leak-prover.mjs'

test('proveHandleSafety approves code with explicit close statements', () => {
  const code = `
const fd = fs.openSync('file.txt', 'r');
try {
  // read
} finally {
  fs.closeSync(fd);
}
`
  const result = proveHandleSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.handleProof, 'ALL_FILE_HANDLES_DETERMINISTICALLY_CLOSED')
  assert.equal(result.violationsCount, 0)
})

test('proveHandleSafety detects unclosed file descriptors', () => {
  const code = `
const fd = fs.openSync('file.txt', 'r');
const data = fs.readFileSync(fd);
`
  const result = proveHandleSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.handleProof, 'UNCLOSED_DESCRIPTOR_LEAK_DETECTED')
  assert.equal(result.violationsCount, 1)
})
