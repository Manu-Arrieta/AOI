import test from 'node:test'
import assert from 'node:assert/strict'
import { auditStreamPipeDestroySafety } from './stream-pipe-destroy-guard.mjs'

test('auditStreamPipeDestroySafety approves stream.pipeline usage', () => {
  const code = `
import { pipeline } from 'node:stream/promises';
await pipeline(readable, transform, writable);
`
  const result = auditStreamPipeDestroySafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.pipeProof, 'STREAM_PIPE_AUTO_DESTROY_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditStreamPipeDestroySafety detects raw unguarded stream pipe without error handler', () => {
  const code = `
readable.pipe(writable);
`
  const result = auditStreamPipeDestroySafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.pipeProof, 'LEAKY_RAW_STREAM_PIPE_DETECTED')
  assert.equal(result.violationsCount, 1)
})
