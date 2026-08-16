import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadPackageExports } from './dead-export-package-pruner.mjs'

test('auditDeadPackageExports approves fully referenced package export subpaths', () => {
  const exports = ['.', './utils']
  const code = `
import { main } from '@aoi/core';
import { helper } from '@aoi/core/utils';
`
  const result = auditDeadPackageExports('@aoi/core', exports, code)
  assert.equal(result.allReferenced, true)
  assert.equal(result.exportProof, 'ALL_PACKAGE_EXPORTS_REFERENCED')
  assert.equal(result.deadExportsCount, 0)
})

test('auditDeadPackageExports detects unreferenced dead package exports', () => {
  const exports = ['.', './legacy']
  const code = `
import { main } from '@aoi/core';
`
  const result = auditDeadPackageExports('@aoi/core', exports, code)
  assert.equal(result.allReferenced, false)
  assert.equal(result.exportProof, 'DEAD_PACKAGE_EXPORTS_DETECTED')
  assert.equal(result.deadExportsCount, 1)
  assert.equal(result.deadExports[0].subpath, './legacy')
})
