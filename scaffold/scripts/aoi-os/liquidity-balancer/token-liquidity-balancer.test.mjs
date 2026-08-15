import test from 'node:test'
import assert from 'node:assert/strict'
import { balanceTokenLiquidity } from './token-liquidity-balancer.mjs'

test('balanceTokenLiquidity allocates proportional token budgets without starvation', () => {
  const tasks = [
    { taskId: 'T-1', role: 'devops', complexity: 'low' },
    { taskId: 'T-2', role: 'frontend', complexity: 'medium' },
    { taskId: 'T-3', role: 'architect', complexity: 'extreme' },
  ]

  const result = balanceTokenLiquidity(110000, tasks)
  assert.equal(result.totalTasks, 3)
  assert.equal(result.liquidityStatus, 'BALANCED_AND_STARVATION_FREE')

  // low (weight 1): ~10k, medium (weight 2): ~20k, extreme (weight 8): ~80k
  assert.ok(result.allocations['T-1'].allocatedBudget >= 9000)
  assert.ok(result.allocations['T-2'].allocatedBudget >= 18000)
  assert.ok(result.allocations['T-3'].allocatedBudget >= 75000)
})
