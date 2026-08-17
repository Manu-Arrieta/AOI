import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadPackageExportConditions } from './dead-package-export-condition-pruner.mjs'

test('auditDeadPackageExportConditions approves valid conditional export map', () => {
  const pkg = {
    exports: {
      '.': {
        import: './dist/index.mjs',
        types: './dist/index.d.ts',
      },
    },
  }
  const files = ['dist/index.mjs', 'dist/index.d.ts']
  const result = auditDeadPackageExportConditions(pkg, files)
  assert.equal(result.clean, true)
  assert.equal(result.exportConditionProof, 'PACKAGE_EXPORT_CONDITIONS_CANONICAL')
  assert.equal(result.deadCount, 0)
})

test('auditDeadPackageExportConditions detects dead export condition targeting missing file', () => {
  const pkg = {
    exports: {
      '.': {
        import: './dist/index.mjs',
        require: './dist/index.cjs',
      },
    },
  }
  const files = ['dist/index.mjs']
  const result = auditDeadPackageExportConditions(pkg, files)
  assert.equal(result.clean, false)
  assert.equal(result.exportConditionProof, 'DEAD_EXPORT_CONDITIONS_DETECTED')
  assert.equal(result.deadCount, 1)
  assert.equal(result.deadExportConditions[0].target, './dist/index.cjs')
})
