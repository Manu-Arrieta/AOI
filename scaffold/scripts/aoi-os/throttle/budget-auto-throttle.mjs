/**
 * scripts/aoi-os/throttle/budget-auto-throttle.mjs
 *
 * Deterministic Token Velocity & Dynamic Budget Auto-Throttle for AOI-OS:
 * Evaluates rolling token consumption against total wave budget,
 * dynamically adjusting skeletonization levels to prevent exhaustion (0 LLM Tokens).
 */

/**
 * Calculates the adaptive auto-throttle policy based on token expenditure.
 *
 * @param {object} options
 * @param {number} options.spentTokens
 * @param {number} [options.totalBudget=200000]
 * @returns {object} Throttle policy and recommended pruning level
 */
export function calculateBudgetThrottle(options = {}) {
  const { spentTokens = 0, totalBudget = 200000 } = options
  const ratio = totalBudget > 0 ? spentTokens / totalBudget : 0
  const utilizationPct = Math.min(100, Math.round(ratio * 100))

  let throttleMode = 'STANDARD'
  let recommendedPruneLevel = 'NORMAL'
  let allowedTokensPerTask = 8000

  if (utilizationPct >= 80) {
    throttleMode = 'ULTRA_SKELETONIZED_EMERGENCY'
    recommendedPruneLevel = 'EMERGENCY_SIGNATURES_ONLY'
    allowedTokensPerTask = 2000
  } else if (utilizationPct >= 50) {
    throttleMode = 'AGGRESSIVE_THROTTLE'
    recommendedPruneLevel = 'AGGRESSIVE_PRUNED'
    allowedTokensPerTask = 4000
  }

  return {
    spentTokens,
    totalBudget,
    utilizationPct,
    throttleMode,
    recommendedPruneLevel,
    allowedTokensPerTask,
    throttleProof: 'BUDGET_AUTO_THROTTLE_CALCULATED',
  }
}
