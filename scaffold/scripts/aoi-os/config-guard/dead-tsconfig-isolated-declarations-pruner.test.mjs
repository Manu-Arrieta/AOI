import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTsconfigIsolatedDeclarations } from './dead-tsconfig-isolated-declarations-pruner.mjs'

test('auditDeadTsconfigIsolatedDeclarations approves valid isolatedDeclarations with declaration true', () => {
  const tsconfig = {
    compilerOptions: {
      isolatedDeclarations: true,
      declaration: true,
    },
  }

  const result = auditDeadTsconfigIsolatedDeclarations(tsconfig)
  assert.equal(result.clean, true)
  assert.equal(result.isInvalid, false)
  assert.equal(result.isolatedDeclarationsProof, 'TSCONFIG_ISOLATED_DECLARATIONS_VALID')
})

test('auditDeadTsconfigIsolatedDeclarations detects and repairs isolatedDeclarations without declaration', () => {
  const tsconfig = {
    compilerOptions: {
      isolatedDeclarations: true,
    },
  }

  const result = auditDeadTsconfigIsolatedDeclarations(tsconfig)
  assert.equal(result.clean, false)
  assert.equal(result.isInvalid, true)
  assert.equal(result.isolatedDeclarationsProof, 'INVALID_ISOLATED_DECLARATIONS_REPAIRED_WITH_DECLARATION')
  assert.equal(result.prunedTsconfig.compilerOptions.declaration, true)
})
