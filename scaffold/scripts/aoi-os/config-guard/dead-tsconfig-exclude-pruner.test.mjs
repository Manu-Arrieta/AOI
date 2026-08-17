import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTsconfigExcludes } from './dead-tsconfig-exclude-pruner.mjs'

test('auditDeadTsconfigExcludes approves valid matching exclude patterns', () => {
  const tsconfig = {
    exclude: ['node_modules', 'dist', 'coverage'],
  }
  const existingFiles = ['dist/index.js', 'coverage/lcov.info', 'src/index.ts']
  const result = auditDeadTsconfigExcludes(tsconfig, existingFiles)
  assert.equal(result.clean, true)
  assert.equal(result.excludeProof, 'TSCONFIG_EXCLUDE_PATTERNS_CANONICAL')
  assert.equal(result.deadCount, 0)
})

test('auditDeadTsconfigExcludes detects dead non-matching exclude patterns', () => {
  const tsconfig = {
    exclude: ['node_modules', 'build_legacy_temp'],
  }
  const existingFiles = ['src/index.ts']
  const result = auditDeadTsconfigExcludes(tsconfig, existingFiles)
  assert.equal(result.clean, false)
  assert.equal(result.excludeProof, 'DEAD_TSCONFIG_EXCLUDES_DETECTED')
  assert.equal(result.deadCount, 1)
  assert.equal(result.deadExcludes[0].pattern, 'build_legacy_temp')
})
