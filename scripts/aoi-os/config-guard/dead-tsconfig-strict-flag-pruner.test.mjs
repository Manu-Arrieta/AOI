import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTsconfigStrictFlags } from './dead-tsconfig-strict-flag-pruner.mjs'

test('auditDeadTsconfigStrictFlags approves canonical strict: true without redundant sub-flags', () => {
  const tsconfig = {
    compilerOptions: {
      strict: true,
      target: 'es2022',
    },
  }
  const result = auditDeadTsconfigStrictFlags(tsconfig)
  assert.equal(result.clean, true)
  assert.equal(result.strictProof, 'TSCONFIG_STRICT_FLAGS_CANONICAL')
  assert.equal(result.deadCount, 0)
})

test('auditDeadTsconfigStrictFlags detects redundant strict sub-flags when strict is true', () => {
  const tsconfig = {
    compilerOptions: {
      strict: true,
      noImplicitAny: true,
      strictNullChecks: true,
      target: 'es2022',
    },
  }
  const result = auditDeadTsconfigStrictFlags(tsconfig)
  assert.equal(result.clean, false)
  assert.equal(result.strictProof, 'REDUNDANT_STRICT_SUB_FLAGS_DETECTED')
  assert.equal(result.deadCount, 2)
})
