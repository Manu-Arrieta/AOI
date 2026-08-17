import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTsconfigComposite } from './dead-tsconfig-composite-pruner.mjs'

test('auditDeadTsconfigComposite approves valid composite: true with declaration: true', () => {
  const tsconfig = {
    compilerOptions: {
      composite: true,
      declaration: true,
    },
  }
  const result = auditDeadTsconfigComposite(tsconfig)
  assert.equal(result.clean, true)
  assert.equal(result.compositeProof, 'TSCONFIG_COMPOSITE_VALID')
  assert.equal(result.deadCount, 0)
})

test('auditDeadTsconfigComposite detects invalid composite: true with declaration: false', () => {
  const tsconfig = {
    compilerOptions: {
      composite: true,
      declaration: false,
    },
  }
  const result = auditDeadTsconfigComposite(tsconfig)
  assert.equal(result.clean, false)
  assert.equal(result.compositeProof, 'INVALID_COMPOSITE_DECLARATION_CONFLICT')
  assert.equal(result.deadCount, 1)
})
