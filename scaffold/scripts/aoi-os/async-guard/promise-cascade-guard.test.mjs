import test from 'node:test'
import assert from 'node:assert/strict'
import { auditAsyncSafety } from './promise-cascade-guard.mjs'

test('auditAsyncSafety approves bounded and properly awaited async code', () => {
  const code = `
export async function processItems(items: string[]) {
  for (const item of items) {
    await saveItemAsync(item);
  }
}
`
  const result = auditAsyncSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.asyncProof, 'ASYNC_EVENT_LOOP_BOUNDED_AND_SAFE')
  assert.equal(result.violationsCount, 0)
})

test('auditAsyncSafety detects un-awaited async calls in loops', () => {
  const code = `
export function processItems(items: string[]) {
  for (const item of items) {
    saveItemAsync(item);
  }
}
`
  const result = auditAsyncSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.asyncProof, 'ASYNC_CASCADE_OR_DEADLOCK_RISK_DETECTED')
  assert.equal(result.violationsCount, 1)
})
