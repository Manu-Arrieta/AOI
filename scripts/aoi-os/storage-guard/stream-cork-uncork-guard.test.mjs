import test from 'node:test'
import assert from 'node:assert/strict'
import { auditStreamCorkUncorkSafety } from './stream-cork-uncork-guard.mjs'

test('auditStreamCorkUncorkSafety approves stream batching with paired cork and uncork in nextTick', () => {
  const code = `
writable.cork();
writable.write('chunk 1');
writable.write('chunk 2');
process.nextTick(() => writable.uncork());
`
  const result = auditStreamCorkUncorkSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.corkProof, 'DETERMINISTIC_STREAM_UNCORK_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditStreamCorkUncorkSafety detects stream cork missing uncork call', () => {
  const code = `
writable.cork();
writable.write('chunk 1');
writable.write('chunk 2');
// Missing uncork()
`
  const result = auditStreamCorkUncorkSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.corkProof, 'UNFLUSHED_CORKED_STREAM_LEAK_RISK')
  assert.equal(result.violationsCount, 1)
})
