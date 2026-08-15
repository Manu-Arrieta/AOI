/**
 * scripts/aoi-os/sandbox-runtime/token-velocity-guard.mjs
 *
 * Dynamic Token Velocity & Budget Governor for AOI-OS:
 * Tracks token consumption velocity per task and wave, flags anomalies,
 * and throttles or switches to hyper-compressed prompt modes to prevent cost overruns.
 */

/**
 * Creates a Token Velocity Governor for an execution session.
 *
 * @param {object} [options]
 * @param {number} [options.globalTokenBudget=200000] - Total tokens allocated for session
 * @param {number} [options.expectedTokensPerTask=5000] - Expected average tokens per atomic task
 * @param {number} [options.anomalyThresholdPercent=40] - Percent overrun to trigger throttle
 * @returns {object} Token Governor
 */
export function createTokenVelocityGuard(options = {}) {
  const {
    globalTokenBudget = 200000,
    expectedTokensPerTask = 5000,
    anomalyThresholdPercent = 40,
  } = options

  let totalTokensConsumed = 0
  const taskRecords = new Map()

  /**
   * Records token usage for a task execution.
   *
   * @param {string} taskId
   * @param {number} tokensUsed
   * @param {string} [role='general']
   * @returns {object} Assessment result
   */
  function recordUsage(taskId, tokensUsed, role = 'general') {
    totalTokensConsumed += tokensUsed
    const prev = taskRecords.get(taskId) || { total: 0, executions: 0, role }
    prev.total += tokensUsed
    prev.executions += 1
    taskRecords.set(taskId, prev)

    const remainingBudget = Math.max(0, globalTokenBudget - totalTokensConsumed)
    const threshold = expectedTokensPerTask * (1 + anomalyThresholdPercent / 100)
    const isAnomaly = tokensUsed > threshold

    return {
      taskId,
      tokensUsed,
      totalTaskTokens: prev.total,
      totalSessionTokens: totalTokensConsumed,
      remainingBudget,
      isAnomaly,
      recommendedMode: isAnomaly ? 'hyper_compressed' : 'standard',
      budgetExhausted: remainingBudget === 0,
    }
  }

  /**
   * Retrieves overall governor metrics.
   *
   * @returns {object}
   */
  function getMetrics() {
    return {
      globalTokenBudget,
      totalTokensConsumed,
      remainingBudget: Math.max(0, globalTokenBudget - totalTokensConsumed),
      utilizationPercent: Math.min(100, (totalTokensConsumed / globalTokenBudget) * 100),
      recordedTasksCount: taskRecords.size,
    }
  }

  return {
    recordUsage,
    getMetrics,
  }
}
