import test from 'node:test'
import assert from 'node:assert/strict'
import { virtualizeControlFlow } from './branchless-virtualizer.mjs'

test('virtualizeControlFlow proves resource safety for clean try-finally blocks', () => {
  const safeCode = `
export async function executeWithLock(mutex: any, fn: Function) {
  await mutex.acquire();
  try {
    return await fn();
  } finally {
    mutex.release();
  }
}
`
  const result = virtualizeControlFlow(safeCode)
  assert.equal(result.safe, true)
  assert.equal(result.invariants.mutexHandled, true)
  assert.equal(result.invariants.handlesClean, true)
  assert.equal(result.resourceLeaks.length, 0)
})

test('virtualizeControlFlow flags unreleased mutex risks', () => {
  const unsafeCode = `
export async function badLock(mutex: any, fn: Function) {
  await mutex.acquire();
  if (Math.random() > 0.5) throw new Error("crash");
  mutex.release();
}
`
  const result = virtualizeControlFlow(unsafeCode)
  assert.equal(result.safe, false)
  assert.equal(result.invariants.mutexHandled, false)
  assert.ok(result.resourceLeaks.some((r) => r.type === 'UNRELEASED_MUTEX_RISK'))
})
