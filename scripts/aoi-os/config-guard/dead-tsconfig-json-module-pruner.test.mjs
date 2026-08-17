import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTsconfigJsonModule } from './dead-tsconfig-json-module-pruner.mjs'

test('auditDeadTsconfigJsonModule approves modern moduleResolution without redundant resolveJsonModule', () => {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      moduleResolution: 'bundler',
    },
  }
  const result = auditDeadTsconfigJsonModule(tsconfig)
  assert.equal(result.clean, true)
  assert.equal(result.jsonModuleProof, 'TSCONFIG_JSON_MODULE_CANONICAL')
  assert.equal(result.deadCount, 0)
})

test('auditDeadTsconfigJsonModule detects redundant resolveJsonModule under bundler resolution', () => {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
    },
  }
  const result = auditDeadTsconfigJsonModule(tsconfig)
  assert.equal(result.clean, false)
  assert.equal(result.jsonModuleProof, 'REDUNDANT_RESOLVE_JSON_MODULE_DETECTED')
  assert.equal(result.deadCount, 1)
})
