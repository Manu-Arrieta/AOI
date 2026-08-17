import test from 'node:test'
import assert from 'node:assert/strict'
import { auditSpanLifecycleSafety } from './span-lifecycle-guard.mjs'

test('auditSpanLifecycleSafety approves span with end inside finally block', () => {
  const code = `
const span = tracer.startSpan('processTask');
try {
  await doWork();
} finally {
  span.end();
}
`
  const result = auditSpanLifecycleSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.spanProof, 'SPAN_LIFECYCLE_TERMINATION_PROVEN')
  assert.equal(result.violationsCount, 0)
})

test('auditSpanLifecycleSafety detects unclosed span missing end call', () => {
  const code = `
const span = tracer.startSpan('processTask');
await doWork();
`
  const result = auditSpanLifecycleSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.spanProof, 'UNCLOSED_TRACER_SPAN_DETECTED')
  assert.equal(result.violationsCount, 1)
})
