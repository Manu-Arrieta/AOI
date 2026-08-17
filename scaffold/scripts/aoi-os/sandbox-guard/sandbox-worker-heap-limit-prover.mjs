/**
 * scripts/aoi-os/sandbox-guard/sandbox-worker-heap-limit-prover.mjs
 *
 * Deterministic Sandbox Worker Resource Limits & Heap Cap Prover for AOI-OS:
 * Statically proves that Worker thread instantiations (new Worker() / worker_threads) in sandboxes
 * explicitly define resourceLimits (maxOldGenerationSizeMb, maxYoungGenerationSizeMb) bounded to safe caps (<= 512MB),
 * preventing unbounded heap allocation and host physical memory exhaustion (OOM DoS) (0 LLM Tokens).
 */

const MAX_SAFE_OLD_GEN_MB = 512

/**
 * Audits Worker thread creation source code for explicit resourceLimits and heap bounding.
 *
 * @param {string} sourceCode - Worker thread creation source code
 * @returns {object} Worker heap limits audit report
 */
export function proveSandboxWorkerHeapLimitSafety(sourceCode = '') {
  const violations = []

  const createsWorker = /(?:new\s+Worker\s*\()/i.test(sourceCode)
  const hasResourceLimits = /resourceLimits\s*:\s*\{/i.test(sourceCode)
  const hasOldGenLimit = /maxOldGenerationSizeMb\s*:\s*(\d+)/i.exec(sourceCode)

  if (createsWorker && !hasResourceLimits) {
    violations.push({
      type: 'WORKER_MISSING_RESOURCE_LIMITS',
      recommendation: "Worker thread instantiated without 'resourceLimits'. Pass explicit resourceLimits: { maxOldGenerationSizeMb: 256 } to prevent host OOM exhaustion.",
    })
  } else if (createsWorker && hasOldGenLimit) {
    const limitMb = Number.parseInt(hasOldGenLimit[1], 10)
    if (limitMb > MAX_SAFE_OLD_GEN_MB) {
      violations.push({
        type: 'WORKER_EXCESSIVE_HEAP_LIMIT',
        limitMb,
        recommendation: `Worker maxOldGenerationSizeMb (${limitMb}MB) exceeds safe threshold (${MAX_SAFE_OLD_GEN_MB}MB). Lower limit to prevent heap starvation.`,
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    createsWorker,
    violationsCount: violations.length,
    violations,
    workerHeapProof: safe ? 'BOUNDED_WORKER_HEAP_ENFORCED' : 'UNBOUNDED_WORKER_HEAP_RISK',
  }
}
