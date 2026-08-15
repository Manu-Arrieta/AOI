import test from 'node:test'
import assert from 'node:assert/strict'
import { auditPeerDependencyConvergence } from './peer-dependency-guard.mjs'

test('auditPeerDependencyConvergence approves unified package versions', () => {
  const manifests = [
    { name: 'app-web', peerDependencies: { vue: '^3.5.0' } },
    { name: 'ui-lib', peerDependencies: { vue: '^3.5.0' } },
  ]
  const result = auditPeerDependencyConvergence(manifests)
  assert.equal(result.convergent, true)
  assert.equal(result.convergenceProof, 'ALL_PEER_DEPENDENCIES_CONVERGENT_AND_UNIFIED')
  assert.equal(result.conflictsCount, 0)
})

test('auditPeerDependencyConvergence detects peer dependency version divergence', () => {
  const manifests = [
    { name: 'app-web', peerDependencies: { vue: '^3.5.0' } },
    { name: 'ui-lib', peerDependencies: { vue: '^3.4.0' } },
  ]
  const result = auditPeerDependencyConvergence(manifests)
  assert.equal(result.convergent, false)
  assert.equal(result.convergenceProof, 'PEER_DEPENDENCY_DRIFT_DETECTED')
  assert.equal(result.conflictsCount, 1)
  assert.equal(result.conflicts[0].dependency, 'vue')
})
