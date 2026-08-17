import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTsconfigPathPrefixes } from './dead-tsconfig-path-prefix-pruner.mjs'

test('auditDeadTsconfigPathPrefixes approves valid existing path mappings', () => {
  const tsconfig = {
    compilerOptions: {
      paths: {
        '@core/*': ['src/core/*'],
        '@components/*': ['src/components/*'],
      },
    },
  }
  const existingDirs = ['src/core', 'src/components']
  const result = auditDeadTsconfigPathPrefixes(tsconfig, existingDirs)
  assert.equal(result.clean, true)
  assert.equal(result.pathsProof, 'TSCONFIG_PATH_MAPPINGS_CANONICAL')
  assert.equal(result.deadCount, 0)
})

test('auditDeadTsconfigPathPrefixes detects non-existent path mapping target', () => {
  const tsconfig = {
    compilerOptions: {
      paths: {
        '@legacy/*': ['src/legacy_deprecated/*'],
      },
    },
  }
  const existingDirs = ['src/core', 'src/components']
  const result = auditDeadTsconfigPathPrefixes(tsconfig, existingDirs)
  assert.equal(result.clean, false)
  assert.equal(result.pathsProof, 'DEAD_TSCONFIG_PATH_PREFIXES_DETECTED')
  assert.equal(result.deadCount, 1)
  assert.equal(result.deadPaths[0].alias, '@legacy/*')
})
