import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadPackageScripts } from './dead-script-pruner.mjs'

test('auditDeadPackageScripts approves fully referenced package scripts', () => {
  const scripts = ['build:dashboard', 'test:parity']
  const workflows = `
steps:
  - run: pnpm build:dashboard
  - run: pnpm test:parity
`
  const result = auditDeadPackageScripts(scripts, workflows)
  assert.equal(result.allReferenced, true)
  assert.equal(result.scriptProof, 'ALL_PACKAGE_SCRIPTS_REFERENCED')
  assert.equal(result.deadScriptsCount, 0)
})

test('auditDeadPackageScripts detects unreferenced dead scripts', () => {
  const scripts = ['build:dashboard', 'legacy-test-v1']
  const workflows = `
steps:
  - run: pnpm build:dashboard
`
  const result = auditDeadPackageScripts(scripts, workflows)
  assert.equal(result.allReferenced, false)
  assert.equal(result.scriptProof, 'DEAD_PACKAGE_SCRIPTS_DETECTED')
  assert.equal(result.deadScriptsCount, 1)
  assert.equal(result.deadScripts[0].scriptName, 'legacy-test-v1')
})
