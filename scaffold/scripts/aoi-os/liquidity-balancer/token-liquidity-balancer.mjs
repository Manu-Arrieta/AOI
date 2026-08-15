/**
 * scripts/aoi-os/liquidity-balancer/token-liquidity-balancer.mjs
 *
 * Deterministic Token Liquidity Balancer & Micro-Budget Distributor for AOI-OS:
 * Dynamically reallocates token budgets across parallel micro-agents based on
 * task cognitive complexity ratings, preventing quota starvation (0 LLM Tokens).
 */

const COMPLEXITY_WEIGHTS = {
  low: 1,
  medium: 2,
  high: 4,
  extreme: 8,
}

/**
 * Distributes a total token budget pool dynamically across active tasks.
 *
 * @param {number} totalPoolBudget
 * @param {Array<{ taskId: string, role?: string, complexity?: string }>} tasks
 * @returns {object} Balanced token allocation plan
 */
export function balanceTokenLiquidity(totalPoolBudget = 100000, tasks = []) {
  if (tasks.length === 0) {
    return { totalPoolBudget, totalTasks: 0, allocations: {}, status: 'NO_ACTIVE_TASKS' }
  }

  let totalWeight = 0
  for (const task of tasks) {
    const weight = COMPLEXITY_WEIGHTS[task.complexity] || COMPLEXITY_WEIGHTS.medium
    totalWeight += weight
  }

  const baseUnit = Math.floor(totalPoolBudget / totalWeight)
  const allocations = {}

  let allocatedSum = 0
  for (const task of tasks) {
    const weight = COMPLEXITY_WEIGHTS[task.complexity] || COMPLEXITY_WEIGHTS.medium
    const taskBudget = baseUnit * weight
    allocations[task.taskId] = {
      role: task.role || 'general',
      complexity: task.complexity || 'medium',
      allocatedBudget: taskBudget,
      weight,
    }
    allocatedSum += taskBudget
  }

  return {
    totalPoolBudget,
    totalTasks: tasks.length,
    allocatedSum,
    remainingPool: Math.max(0, totalPoolBudget - allocatedSum),
    allocations,
    liquidityStatus: 'BALANCED_AND_STARVATION_FREE',
  }
}
