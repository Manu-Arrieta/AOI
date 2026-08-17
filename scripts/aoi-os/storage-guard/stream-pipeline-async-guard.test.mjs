import test from 'node:test'
import assert from 'node:assert/strict'
import { auditStreamPipelineAsyncSafety } from './stream-pipeline-async-guard.mjs'

test('auditStreamPipelineAsyncSafety approves awaited stream/promises pipeline', () => {
  const code = `
import { pipeline } from 'node:stream/promises';

async function copyData(src, dest) {
  await pipeline(src, dest);
}
`
  const result = auditStreamPipelineAsyncSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.pipelineProof, 'STREAM_PIPELINE_PROMISE_AWAITED')
  assert.equal(result.violationsCount, 0)
})

test('auditStreamPipelineAsyncSafety detects unawaited stream/promises pipeline', () => {
  const code = `
import { pipeline } from 'node:stream/promises';

function copyData(src, dest) {
  pipeline(src, dest); // floating promise
}
`
  const result = auditStreamPipelineAsyncSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.pipelineProof, 'FLOATING_STREAM_PIPELINE_RISK')
  assert.equal(result.violationsCount, 1)
})
