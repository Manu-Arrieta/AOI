import test from 'node:test'
import assert from 'node:assert/strict'
import { auditBufferSliceBoundsSafety } from './buffer-slice-bounds-guard.mjs'

test('auditBufferSliceBoundsSafety approves buffer slice with explicit bounds check', () => {
  const code = `
function extractSlice(buf, offset, length) {
  if (offset + length > buf.length) {
    throw new RangeError('Offset out of bounds');
  }
  return buf.subarray(offset, offset + length);
}
`
  const result = auditBufferSliceBoundsSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.boundsProof, 'SAFE_BUFFER_BOUNDARY_VALIDATION_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditBufferSliceBoundsSafety detects unguarded dynamic buffer slicing without check', () => {
  const code = `
function extractSlice(buf, offset, length) {
  return buf.subarray(offset, offset + length);
}
`
  const result = auditBufferSliceBoundsSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.boundsProof, 'UNGUARDED_BUFFER_OUT_OF_BOUNDS_RISK')
  assert.equal(result.violationsCount, 1)
})
