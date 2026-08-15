import test from 'node:test'
import assert from 'node:assert/strict'
import { broadcastAbiWave } from './abi-wave-broadcaster.mjs'

test('broadcastAbiWave identifies affected packages and synthesizes synchronization wave', () => {
  const dependents = {
    'agentic-ops-dashboard': ['contracts/task-event.ts'],
    'customer-portal': ['contracts/user.ts'],
    'api-gateway': ['contracts/task-event.ts', 'contracts/auth.ts'],
  }

  const result = broadcastAbiWave('contracts/task-event.ts', dependents)
  assert.equal(result.totalAffectedWorkspaces, 2)
  assert.deepEqual(result.affectedWorkspaces, ['agentic-ops-dashboard', 'api-gateway'])
  assert.equal(result.propagationProof, 'ABI_PROPAGATION_WAVES_SYNTHESIZED')
})

test('broadcastAbiWave reports zero downstream impact when contract is unused', () => {
  const dependents = {
    'customer-portal': ['contracts/user.ts'],
  }

  const result = broadcastAbiWave('contracts/isolated-internal.ts', dependents)
  assert.equal(result.totalAffectedWorkspaces, 0)
  assert.equal(result.propagationProof, 'ZERO_DOWNSTREAM_IMPACT')
})
