import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTsconfigIncludes } from './dead-tsconfig-include-pruner.mjs'

test('auditDeadTsconfigIncludes approves valid tsconfig include patterns', () => {
  const tsconfig = {
    include: ['src/**/*', 'types/**/*', 'env.d.ts'],
  }
  const workspaceFiles = ['src/index.ts', 'src/utils.ts', 'types/index.d.ts', 'env.d.ts']
  const result = auditDeadTsconfigIncludes(tsconfig, workspaceFiles)
  assert.equal(result.clean, true)
  assert.equal(result.includeProof, 'TSCONFIG_INCLUDE_PATHS_CANONICAL')
  assert.equal(result.deadCount, 0)
})

test('auditDeadTsconfigIncludes detects dead include pattern for non-existent directory', () => {
  const tsconfig = {
    include: ['src/**/*', 'legacy-v1/**/*'],
  }
  const workspaceFiles = ['src/index.ts']
  const result = auditDeadTsconfigIncludes(tsconfig, workspaceFiles)
  assert.equal(result.clean, false)
  assert.equal(result.includeProof, 'DEAD_TSCONFIG_INCLUDES_DETECTED')
  assert.equal(result.deadCount, 1)
  assert.equal(result.deadIncludes[0].pattern, 'legacy-v1/**/*')
})
