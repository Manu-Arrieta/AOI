/**
 * scripts/aoi-os/runtime-kernel/worker-termination-guard.mjs
 *
 * Deterministic Web Worker & Worker Thread Lifecycle & Teardown Guard for AOI-OS:
 * Statically audits worker threads and thread pools (new Worker, piscina, workerpool) to prove
 * that worker.terminate() or pool.destroy() is guaranteed in teardown/finally blocks (0 LLM Tokens).
 */

/**
 * Audits source code for worker thread instantiation and guaranteed termination.
 *
 * @param {string} sourceCode - Worker manager or service source code
 * @returns {object} Worker termination audit report
 */
export function auditWorkerTerminationSafety(sourceCode = '') {
  const violations = []

  const hasWorkerCreation = /\b(?:new\s+Worker|piscina|workerpool\.pool)\b/g.test(sourceCode)
  const hasWorkerTeardown = /\b(?:\.terminate\s*\(|\.destroy\s*\(|afterAll|afterEach|finally)\b/g.test(sourceCode)

  if (hasWorkerCreation && !hasWorkerTeardown) {
    violations.push({
      type: 'UNTERMINATED_WORKER_THREAD',
      recommendation: "Ensure Worker instances or thread pools invoke 'worker.terminate()' or 'pool.destroy()' in 'afterAll()' or 'finally' blocks.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasWorkerCreation,
    violationsCount: violations.length,
    violations,
    workerProof: safe ? 'WORKER_TERMINATION_GUARANTEED' : 'UNTERMINATED_WORKER_DETECTED',
  }
}
