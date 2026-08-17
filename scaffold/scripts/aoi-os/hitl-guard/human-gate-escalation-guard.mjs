/**
 * scripts/aoi-os/hitl-guard/human-gate-escalation-guard.mjs
 *
 * Deterministic Human Gate Escalation Guard for AOI-OS Human-in-the-Loop:
 * Audits execution state, AST contract blast radius, and self-healing telemetry to ensure
 * that any critical architectural divergence or failed healing threshold triggers an explicit
 * synchronous human escalation approval gate before any commit or merge (0 LLM Tokens).
 */

/**
 * Evaluates whether an execution state requires human intervention/escalation.
 *
 * @param {object} params
 * @param {string} params.taskId - Task identifier
 * @param {string} [params.blastRadius='low'] - 'low' | 'medium' | 'critical'
 * @param {number} [params.healingAttempts=0] - Number of self-healing cycles executed
 * @param {number} [params.maxHealingAttempts=2] - Maximum allowed auto-healing threshold
 * @param {boolean} [params.hasBreakingContractChange=false] - True if public interface modified
 * @param {boolean} [params.hasExplicitHumanApproval=false] - True if human approved gate
 * @returns {object} Human gate evaluation report
 */
export function evaluateHumanGateEscalation(params = {}) {
  const {
    taskId,
    blastRadius = 'low',
    healingAttempts = 0,
    maxHealingAttempts = 2,
    hasBreakingContractChange = false,
    hasExplicitHumanApproval = false,
  } = params

  const triggers = []

  if (blastRadius === 'critical') {
    triggers.push('CRITICAL_BLAST_RADIUS_DETECTED')
  }

  if (hasBreakingContractChange) {
    triggers.push('BREAKING_PUBLIC_CONTRACT_MODIFICATION')
  }

  if (healingAttempts >= maxHealingAttempts) {
    triggers.push('EXCEEDED_MAX_SELF_HEALING_RETRIES')
  }

  const escalationRequired = triggers.length > 0
  const canProceed = !escalationRequired || hasExplicitHumanApproval

  return {
    taskId,
    escalationRequired,
    canProceed,
    hasExplicitHumanApproval,
    triggersCount: triggers.length,
    triggers,
    gateProof: canProceed
      ? (escalationRequired ? 'HUMAN_OVERRIDE_APPROVED' : 'AUTOMATED_EXECUTION_CLEARED')
      : 'BLOCKED_PENDING_HUMAN_GOVERNOR_APPROVAL',
  }
}
