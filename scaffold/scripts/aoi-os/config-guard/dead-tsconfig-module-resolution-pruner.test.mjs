import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTsconfigModuleResolution } from './dead-tsconfig-module-resolution-pruner.mjs'

test('auditDeadTsconfigModuleResolution approves valid modern module and resolution', () => {
  const tsconfig = {
    compilerOptions: {
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
    },
  }

  const result = auditDeadTsconfigModuleResolution(tsconfig)
  assert.equal(result.clean, true)
  assert.equal(result.hasIncompatibleResolution, false)
  assert.equal(result.moduleResolutionProof, 'TSCONFIG_MODULE_RESOLUTION_VALID')
})

test('auditDeadTsconfigModuleResolution detects and prunes node16 with classic resolution', () => {
  const tsconfig = {
    compilerOptions: {
      module: 'node16',
      moduleResolution: 'classic',
    },
  }

  const result = auditDeadTsconfigModuleResolution(tsconfig)
  assert.equal(result.clean, false)
  assert.equal(result.hasIncompatibleResolution, true)
  assert.equal(result.moduleResolutionProof, 'INCOMPATIBLE_MODULE_RESOLUTION_PRUNED')
  assert.equal('moduleResolution' in result.prunedTsconfig.compilerOptions, false)
})

test('auditDeadTsconfigModuleResolution updates esnext with classic to bundler', () => {
  const tsconfig = {
    compilerOptions: {
      module: 'esnext',
      moduleResolution: 'classic',
    },
  }

  const result = auditDeadTsconfigModuleResolution(tsconfig)
  assert.equal(result.clean, false)
  assert.equal(result.prunedTsconfig.compilerOptions.moduleResolution, 'bundler')
})
