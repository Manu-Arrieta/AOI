import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTsconfigRewriteRelativeImportExtensions } from './dead-tsconfig-rewrite-relative-import-extensions-pruner.mjs'

test('auditDeadTsconfigRewriteRelativeImportExtensions approves valid configuration with moduleResolution: bundler', () => {
  const tsconfig = {
    compilerOptions: {
      rewriteRelativeImportExtensions: true,
      moduleResolution: 'bundler',
    },
  }
  const result = auditDeadTsconfigRewriteRelativeImportExtensions(tsconfig)
  assert.equal(result.clean, true)
  assert.equal(result.isInvalid, false)
  assert.equal(result.rewriteRelativeImportProof, 'TSCONFIG_REWRITE_RELATIVE_IMPORT_EXTENSIONS_VALID')
})

test('auditDeadTsconfigRewriteRelativeImportExtensions detects and repairs invalid classic resolution', () => {
  const tsconfig = {
    compilerOptions: {
      rewriteRelativeImportExtensions: true,
      moduleResolution: 'classic',
    },
  }
  const result = auditDeadTsconfigRewriteRelativeImportExtensions(tsconfig)
  assert.equal(result.clean, false)
  assert.equal(result.isInvalid, true)
  assert.equal(result.rewriteRelativeImportProof, 'INVALID_REWRITE_IMPORT_EXTENSIONS_REPAIRED_WITH_BUNDLER')
  assert.equal(result.prunedTsconfig.compilerOptions.moduleResolution, 'bundler')
})
