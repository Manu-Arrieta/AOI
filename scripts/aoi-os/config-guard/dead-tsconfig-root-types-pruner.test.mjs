import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTsconfigRootTypes } from './dead-tsconfig-root-types-pruner.mjs'

test('auditDeadTsconfigRootTypes approves frontend tsconfig without node types leakage', () => {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      lib: ['DOM', 'DOM.Iterable'],
      types: ['vite/client'],
    },
  }
  const result = auditDeadTsconfigRootTypes(tsconfig, true)
  assert.equal(result.clean, true)
  assert.equal(result.rootTypesProof, 'FRONTEND_TYPES_CONFINED')
  assert.equal(result.deadCount, 0)
})

test('auditDeadTsconfigRootTypes detects node types leaking into frontend tsconfig', () => {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      lib: ['DOM'],
      types: ['node', 'vite/client'],
    },
  }
  const result = auditDeadTsconfigRootTypes(tsconfig, true)
  assert.equal(result.clean, false)
  assert.equal(result.rootTypesProof, 'NODE_GLOBAL_TYPES_LEAKAGE_DETECTED')
  assert.equal(result.deadCount, 1)
})
