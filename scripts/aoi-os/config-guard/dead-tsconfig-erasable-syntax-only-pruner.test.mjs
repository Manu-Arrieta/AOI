import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTsconfigErasableSyntaxOnly } from './dead-tsconfig-erasable-syntax-only-pruner.mjs'

test('auditDeadTsconfigErasableSyntaxOnly approves clean erasableSyntaxOnly: true', () => {
  const tsconfig = {
    compilerOptions: {
      erasableSyntaxOnly: true,
      target: 'ESNext',
    },
  }
  const result = auditDeadTsconfigErasableSyntaxOnly(tsconfig)
  assert.equal(result.clean, true)
  assert.equal(result.isInvalid, false)
  assert.equal(result.erasableSyntaxProof, 'TSCONFIG_ERASABLE_SYNTAX_VALID')
})

test('auditDeadTsconfigErasableSyntaxOnly detects and prunes incompatible experimentalDecorators', () => {
  const tsconfig = {
    compilerOptions: {
      erasableSyntaxOnly: true,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
    },
  }
  const result = auditDeadTsconfigErasableSyntaxOnly(tsconfig)
  assert.equal(result.clean, false)
  assert.equal(result.isInvalid, true)
  assert.equal(result.erasableSyntaxProof, 'INCOMPATIBLE_ERASABLE_SYNTAX_FLAGS_PRUNED')
  assert.equal(result.prunedTsconfig.compilerOptions.experimentalDecorators, undefined)
  assert.equal(result.prunedTsconfig.compilerOptions.emitDecoratorMetadata, undefined)
})
