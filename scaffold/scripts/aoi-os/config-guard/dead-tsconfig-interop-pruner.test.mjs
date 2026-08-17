import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTsconfigInterop } from './dead-tsconfig-interop-pruner.mjs'

test('auditDeadTsconfigInterop approves canonical esModuleInterop without redundant allowSyntheticDefaultImports', () => {
  const tsconfig = {
    compilerOptions: {
      esModuleInterop: true,
      target: 'es2022',
    },
  }
  const result = auditDeadTsconfigInterop(tsconfig)
  assert.equal(result.clean, true)
  assert.equal(result.interopProof, 'TSCONFIG_INTEROP_CANONICAL')
  assert.equal(result.deadCount, 0)
})

test('auditDeadTsconfigInterop detects redundant allowSyntheticDefaultImports when esModuleInterop is true', () => {
  const tsconfig = {
    compilerOptions: {
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      target: 'es2022',
    },
  }
  const result = auditDeadTsconfigInterop(tsconfig)
  assert.equal(result.clean, false)
  assert.equal(result.interopProof, 'REDUNDANT_TSCONFIG_INTEROP_DETECTED')
  assert.equal(result.deadCount, 1)
})
