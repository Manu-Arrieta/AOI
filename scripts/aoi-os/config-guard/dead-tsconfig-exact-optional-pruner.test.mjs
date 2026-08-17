import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTsconfigExactOptional } from './dead-tsconfig-exact-optional-pruner.mjs'

test('auditDeadTsconfigExactOptional approves clean strict tsconfig', () => {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      strict: true,
      exactOptionalPropertyTypes: true,
    },
  }
  const result = auditDeadTsconfigExactOptional(tsconfig)
  assert.equal(result.clean, true)
  assert.equal(result.exactOptionalProof, 'TSCONFIG_EXACT_OPTIONAL_CANONICAL')
  assert.equal(result.deadCount, 0)
})

test('auditDeadTsconfigExactOptional detects redundant exactOptionalPropertyTypes: false without strict', () => {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      exactOptionalPropertyTypes: false,
    },
  }
  const result = auditDeadTsconfigExactOptional(tsconfig)
  assert.equal(result.clean, false)
  assert.equal(result.exactOptionalProof, 'REDUNDANT_EXACT_OPTIONAL_DETECTED')
  assert.equal(result.deadCount, 1)
})
