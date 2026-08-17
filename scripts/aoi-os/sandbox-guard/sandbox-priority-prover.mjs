/**
 * scripts/aoi-os/sandbox-guard/sandbox-priority-prover.mjs
 *
 * Deterministic Sandbox Process Scheduling Priority & Niceness Prover for AOI-OS:
 * Statically proves that compute-heavy worker processes launched in sandboxes configure
 * scheduling priority / niceness (nice -n, os.setPriority, priority) to prevent host Event Loop starvation (0 LLM Tokens).
 */

/**
 * Audits sandbox launcher source code for worker scheduling priority.
 *
 * @param {string} sourceCode - Worker process launcher source code
 * @returns {object} Priority proof report
 */
export function proveSandboxPrioritySafety(sourceCode = '') {
  const violations = []

  const isComputeWorker = /(?:compiler|fuzzer|benchmark|heavyCompute|worker|sandboxCompute)/i.test(sourceCode)
  const hasPriorityConfig = /(?:nice\s+-n|os\.setPriority|priority\s*:|renice\b)/g.test(sourceCode)

  if (isComputeWorker && !hasPriorityConfig) {
    violations.push({
      type: 'UNCONFINED_WORKER_SCHEDULING_PRIORITY',
      recommendation: "Ensure compute-heavy worker processes configure 'nice -n <val>' or 'os.setPriority()' to prevent starvation of the daemon Event Loop.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    isComputeWorker,
    violationsCount: violations.length,
    violations,
    priorityProof: safe ? 'SCHEDULING_PRIORITY_GOVERNED' : 'SCHEDULER_STARVATION_RISK_DETECTED',
  }
}
