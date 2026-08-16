import test from 'node:test'
import assert from 'node:assert/strict'
import { proveLockfileConvergence } from './lockfile-divergence-prover.mjs'

test('proveLockfileConvergence approves lockfile with single unified version per critical package', () => {
  const versions = {
    vue: ['3.5.34'],
    nitropack: ['2.10.4'],
  }
  const result = proveLockfileConvergence(versions, ['vue', 'nitropack'])
  assert.equal(result.convergent, true)
  assert.equal(result.lockfileProof, 'LOCKFILE_CRITICAL_PACKAGES_UNIFIED')
  assert.equal(result.driftsCount, 0)
})

test('proveLockfileConvergence detects multiple resolved versions for critical packages', () => {
  const versions = {
    vue: ['3.5.34', '3.4.21'],
    nitropack: ['2.10.4'],
  }
  const result = proveLockfileConvergence(versions, ['vue', 'nitropack'])
  assert.equal(result.convergent, false)
  assert.equal(result.lockfileProof, 'LOCKFILE_VERSION_DIVERGENCE_DETECTED')
  assert.equal(result.driftsCount, 1)
  assert.equal(result.drifts[0].package, 'vue')
})
