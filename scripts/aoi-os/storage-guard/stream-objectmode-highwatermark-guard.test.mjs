import test from 'node:test'
import assert from 'node:assert/strict'
import { auditStreamObjectModeHighWaterMarkSafety } from './stream-objectmode-highwatermark-guard.mjs'

test('auditStreamObjectModeHighWaterMarkSafety approves objectMode stream with reasonable object count highWaterMark', () => {
  const code = `
const stream = new Transform({
  objectMode: true,
  highWaterMark: 64,
  transform(chunk, encoding, callback) {
    callback(null, chunk);
  }
});
`
  const result = auditStreamObjectModeHighWaterMarkSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.objectModeProof, 'OBJECT_MODE_HIGHWATERMARK_SCALED')
  assert.equal(result.violationsCount, 0)
})

test('auditStreamObjectModeHighWaterMarkSafety detects objectMode stream with byte-scale highWaterMark', () => {
  const code = `
const stream = new Transform({
  objectMode: true,
  highWaterMark: 65536,
  transform(chunk, encoding, callback) {
    callback(null, chunk);
  }
});
`
  const result = auditStreamObjectModeHighWaterMarkSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.objectModeProof, 'EXCESSIVE_OBJECT_BUFFERING_RISK')
  assert.equal(result.violationsCount, 1)
})
