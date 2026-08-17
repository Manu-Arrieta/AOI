import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTsconfigReferences } from './dead-tsconfig-reference-pruner.mjs'

test('auditDeadTsconfigReferences approves valid tsconfig references', () => {
  const tsconfig = {
    references: [
      { path: './packages/core' },
      { path: './packages/ui' },
    ],
  }
  const validPaths = ['packages/core', 'packages/ui']
  const result = auditDeadTsconfigReferences(tsconfig, validPaths)
  assert.equal(result.clean, true)
  assert.equal(result.referenceProof, 'TSCONFIG_PROJECT_REFERENCES_CANONICAL')
  assert.equal(result.deadCount, 0)
})

test('auditDeadTsconfigReferences detects dead project reference targeting missing directory', () => {
  const tsconfig = {
    references: [
      { path: './packages/core' },
      { path: './packages/deprecated-module' },
    ],
  }
  const validPaths = ['packages/core']
  const result = auditDeadTsconfigReferences(tsconfig, validPaths)
  assert.equal(result.clean, false)
  assert.equal(result.referenceProof, 'DEAD_TSCONFIG_REFERENCES_DETECTED')
  assert.equal(result.deadCount, 1)
  assert.equal(result.deadReferences[0].path, './packages/deprecated-module')
})
