import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadWorkspaceProtocols } from './dead-workspace-protocol-pruner.mjs'

test('auditDeadWorkspaceProtocols approves valid workspace protocol dependencies', () => {
  const pkg = {
    dependencies: {
      '@aoi/core': 'workspace:*',
      '@aoi/ast': 'workspace:^',
    },
    devDependencies: {
      vitest: '^4.0.0',
    },
  }
  const registered = ['@aoi/core', '@aoi/ast', '@aoi/dashboard']
  const result = auditDeadWorkspaceProtocols(pkg, registered)
  assert.equal(result.clean, true)
  assert.equal(result.protocolProof, 'WORKSPACE_PROTOCOLS_CANONICAL')
  assert.equal(result.deadCount, 0)
})

test('auditDeadWorkspaceProtocols detects dead orphan workspace dependency', () => {
  const pkg = {
    dependencies: {
      '@aoi/core': 'workspace:*',
      '@aoi/deleted-module': 'workspace:*',
    },
  }
  const registered = ['@aoi/core']
  const result = auditDeadWorkspaceProtocols(pkg, registered)
  assert.equal(result.clean, false)
  assert.equal(result.protocolProof, 'DEAD_WORKSPACE_PROTOCOLS_DETECTED')
  assert.equal(result.deadCount, 1)
  assert.equal(result.deadWorkspaceDeps[0].dependency, '@aoi/deleted-module')
})
