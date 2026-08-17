import test from 'node:test'
import assert from 'node:assert/strict'
import { auditStreamBackpressureSafety } from './stream-backpressure-guard.mjs'

test('auditStreamBackpressureSafety approves stream with drain handler', () => {
  const code = `
function writeData(stream, chunk) {
  const ok = stream.push(chunk);
  if (!ok) {
    stream.once('drain', () => writeData(stream, chunk));
  }
}
`
  const result = auditStreamBackpressureSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.backpressureProof, 'STREAMING_BACKPRESSURE_HANDLED')
  assert.equal(result.violationsCount, 0)
})

test('auditStreamBackpressureSafety detects unhandled streaming writes without backpressure', () => {
  const code = `
function writeData(res, chunk) {
  res.write(chunk);
}
`
  const result = auditStreamBackpressureSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.backpressureProof, 'UNHANDLED_BACKPRESSURE_RISK_DETECTED')
  assert.equal(result.violationsCount, 1)
})
