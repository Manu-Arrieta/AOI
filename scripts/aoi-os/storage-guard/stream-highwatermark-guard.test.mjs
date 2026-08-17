import test from 'node:test'
import assert from 'node:assert/strict'
import { auditStreamHighWaterMarkSafety } from './stream-highwatermark-guard.mjs'

test('auditStreamHighWaterMarkSafety approves stream with safe 64KB highWaterMark', () => {
  const code = `
const stream = fs.createReadStream('/path/to/large-file.bin', {
  highWaterMark: 64 * 1024,
});
`
  const result = auditStreamHighWaterMarkSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.highWaterMarkProof, 'SAFE_HIGHWATERMARK_BOUNDING_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditStreamHighWaterMarkSafety detects dangerous massive highWaterMark allocation', () => {
  const code = `
const stream = fs.createReadStream('/path/to/large-file.bin', {
  highWaterMark: 50000000,
});
`
  const result = auditStreamHighWaterMarkSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.highWaterMarkProof, 'UNBOUNDED_HIGHWATERMARK_MEMORY_RISK')
  assert.equal(result.violationsCount, 1)
})
