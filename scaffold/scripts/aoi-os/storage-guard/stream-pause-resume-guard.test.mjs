import test from 'node:test'
import assert from 'node:assert/strict'
import { auditStreamPauseResumeSafety } from './stream-pause-resume-guard.mjs'

test('auditStreamPauseResumeSafety approves stream throttling with paired pause and resume', () => {
  const code = `
readable.on('data', async (chunk) => {
  readable.pause();
  await processChunk(chunk);
  readable.resume();
});
`
  const result = auditStreamPauseResumeSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.pauseProof, 'DETERMINISTIC_STREAM_RESUME_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditStreamPauseResumeSafety detects readable stream pause missing resume call', () => {
  const code = `
readable.on('data', async (chunk) => {
  readable.pause();
  await processChunk(chunk);
  // Missing resume()
});
`
  const result = auditStreamPauseResumeSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.pauseProof, 'PERPETUALLY_PAUSED_STREAM_RISK')
  assert.equal(result.violationsCount, 1)
})
