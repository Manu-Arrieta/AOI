import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadWorkspacePackages } from './dead-workspace-package-pruner.mjs'

test('auditDeadWorkspacePackages approves fully referenced workspace packages', () => {
  const declared = ['agentic-ops-dashboard', 'aoi-core']
  const rootManifest = `
{
  "scripts": {
    "dev:dashboard": "pnpm --filter agentic-ops-dashboard dev",
    "test:core": "pnpm --filter aoi-core test"
  }
}
`
  const result = auditDeadWorkspacePackages(declared, rootManifest)
  assert.equal(result.clean, true)
  assert.equal(result.packageProof, 'WORKSPACE_PACKAGES_GOVERNED')
  assert.equal(result.deadCount, 0)
})

test('auditDeadWorkspacePackages detects orphan unreferenced workspace package', () => {
  const declared = ['agentic-ops-dashboard', 'legacy-orphan-pkg']
  const rootManifest = `
{
  "scripts": {
    "dev:dashboard": "pnpm --filter agentic-ops-dashboard dev"
  }
}
`
  const result = auditDeadWorkspacePackages(declared, rootManifest)
  assert.equal(result.clean, false)
  assert.equal(result.packageProof, 'DEAD_WORKSPACE_PACKAGES_DETECTED')
  assert.equal(result.deadCount, 1)
  assert.equal(result.deadPackages[0].package, 'legacy-orphan-pkg')
})
