import test from 'node:test'
import assert from 'node:assert/strict'
import { auditStreamTransformFinalSafety } from './stream-transform-final-guard.mjs'

test('auditStreamTransformFinalSafety approves Transform with callback invocation in _flush', () => {
  const code = `
class HashAggregator extends Transform {
  _transform(chunk, encoding, callback) {
    this.hash.update(chunk);
    callback();
  }
  _flush(callback) {
    this.push(this.hash.digest());
    callback();
  }
}
`
  const result = auditStreamTransformFinalSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.finalProof, 'DETERMINISTIC_TRANSFORM_FINAL_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditStreamTransformFinalSafety detects Transform _flush missing callback invocation', () => {
  const code = `
class HashAggregator extends Transform {
  _flush(callback) {
    this.push(this.hash.digest());
    // Missing callback()
  }
}
`
  const result = auditStreamTransformFinalSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.finalProof, 'HANGING_TRANSFORM_FINAL_RISK')
  assert.equal(result.violationsCount, 1)
})
