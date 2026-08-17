import test from 'node:test'
import assert from 'node:assert/strict'
import { auditStreamMaxListenersSafety } from './stream-max-listeners-guard.mjs'

test('auditStreamMaxListenersSafety approves emitter with setMaxListeners in high-volume pipeline', () => {
  const code = `
function createPipeline(emitter, handlers) {
  emitter.setMaxListeners(50);
  for (const h of handlers) {
    emitter.on('data', h);
  }
}
`
  const result = auditStreamMaxListenersSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.listenersProof, 'SAFE_MAX_LISTENERS_BOUNDING_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditStreamMaxListenersSafety detects unbounded event registration loop without maxListeners or cleanup', () => {
  const code = `
function createPipeline(emitter, handlers) {
  for (const h of handlers) {
    emitter.on('data', h);
  }
}
`
  const result = auditStreamMaxListenersSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.listenersProof, 'UNBOUNDED_MAX_LISTENERS_LEAK_RISK')
  assert.equal(result.violationsCount, 1)
})
