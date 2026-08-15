import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateBudgetThrottle } from './budget-auto-throttle.mjs'

test('calculateBudgetThrottle adjusts pruning levels dynamically based on utilization percentage', () => {
  // Low utilization (<50%)
  const low = calculateBudgetThrottle({ spentTokens: 20000, totalBudget: 100000 })
  assert.equal(low.throttleMode, 'STANDARD')
  assert.equal(low.recommendedPruneLevel, 'NORMAL')

  // Medium utilization (50-80%)
  const med = calculateBudgetThrottle({ spentTokens: 65000, totalBudget: 100000 })
  assert.equal(med.throttleMode, 'AGGRESSIVE_THROTTLE')
  assert.equal(med.recommendedPruneLevel, 'AGGRESSIVE_PRUNED')

  // High utilization (>80%)
  const high = calculateBudgetThrottle({ spentTokens: 85000, totalBudget: 100000 })
  assert.equal(high.throttleMode, 'ULTRA_SKELETONIZED_EMERGENCY')
  assert.equal(high.recommendedPruneLevel, 'EMERGENCY_SIGNATURES_ONLY')
})
