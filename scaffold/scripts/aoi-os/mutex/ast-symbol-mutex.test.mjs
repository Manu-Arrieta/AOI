import test from 'node:test'
import assert from 'node:assert/strict'
import { createAstSymbolMutex } from './ast-symbol-mutex.mjs'

test('createAstSymbolMutex detects file and symbol collisions in waves', () => {
  const mutex = createAstSymbolMutex()

  const tasks = [
    { id: 'T-1', targetFiles: ['server/auth.ts'], targetSymbols: ['login'] },
    { id: 'T-2', targetFiles: ['app/components/Nav.vue'] },
    { id: 'T-3', targetFiles: ['server/auth.ts'], targetSymbols: ['login'] }, // Collision with T-1
  ]

  const contention = mutex.detectContention(tasks)
  assert.equal(contention.hasContention, true)
  assert.equal(contention.conflicts.length, 2)
  assert.equal(contention.conflicts[0].taskA, 'T-1')
  assert.equal(contention.conflicts[0].taskB, 'T-3')
})

test('createAstSymbolMutex acquires and releases locks cleanly', () => {
  const mutex = createAstSymbolMutex()

  // T-1 acquires lock on auth.ts
  const r1 = mutex.acquireLock('T-1', 'server/auth.ts')
  assert.equal(r1.acquired, true)

  // T-2 attempts to acquire lock on auth.ts -> rejected
  const r2 = mutex.acquireLock('T-2', 'server/auth.ts')
  assert.equal(r2.acquired, false)
  assert.equal(r2.heldBy, 'T-1')

  // T-1 releases lock
  const released = mutex.releaseLock('T-1', 'server/auth.ts')
  assert.equal(released, true)

  // T-2 can now acquire lock
  const r3 = mutex.acquireLock('T-2', 'server/auth.ts')
  assert.equal(r3.acquired, true)
})
