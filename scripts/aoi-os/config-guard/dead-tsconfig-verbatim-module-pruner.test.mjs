import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTsconfigVerbatimModule } from './dead-tsconfig-verbatim-module-pruner.mjs'

test('auditDeadTsconfigVerbatimModule approves clean modern verbatimModuleSyntax tsconfig', () => {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      verbatimModuleSyntax: true,
    },
  }
  const result = auditDeadTsconfigVerbatimModule(tsconfig)
  assert.equal(result.clean, true)
  assert.equal(result.verbatimProof, 'TSCONFIG_VERBATIM_MODULE_SYNTAX_CLEAN')
  assert.equal(result.deadCount, 0)
})

test('auditDeadTsconfigVerbatimModule detects deprecated importsNotUsedAsValues and preserveValueImports', () => {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      verbatimModuleSyntax: true,
      importsNotUsedAsValues: 'error',
      preserveValueImports: true,
    },
  }
  const result = auditDeadTsconfigVerbatimModule(tsconfig)
  assert.equal(result.clean, false)
  assert.equal(result.verbatimProof, 'DEPRECATED_IMPORT_FLAGS_DETECTED')
  assert.equal(result.deadCount, 2)
})
