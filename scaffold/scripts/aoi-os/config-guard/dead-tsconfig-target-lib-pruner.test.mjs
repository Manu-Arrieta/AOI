import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTsconfigTargetLib } from './dead-tsconfig-target-lib-pruner.mjs'

test('auditDeadTsconfigTargetLib approves canonical target without redundant lib entry', () => {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      lib: ['DOM', 'DOM.Iterable'],
    },
  }
  const result = auditDeadTsconfigTargetLib(tsconfig)
  assert.equal(result.clean, true)
  assert.equal(result.targetLibProof, 'TARGET_LIB_CANONICAL')
  assert.equal(result.deadCount, 0)
})

test('auditDeadTsconfigTargetLib detects redundant lib entry matching target', () => {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      lib: ['ES2022', 'DOM'],
    },
  }
  const result = auditDeadTsconfigTargetLib(tsconfig)
  assert.equal(result.clean, false)
  assert.equal(result.targetLibProof, 'REDUNDANT_TARGET_LIB_DETECTED')
  assert.equal(result.deadCount, 1)
})
