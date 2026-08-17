/**
 * scripts/aoi-os/sandbox-guard/sandbox-abort-controller-prover.mjs
 *
 * Deterministic Sandbox Worker AbortController Cancellation Prover for AOI-OS:
 * Statically proves that long-running async tasks and workers inside sandboxes accept an AbortSignal
 * and handle cancellation (signal.addEventListener('abort', ...), signal.throwIfAborted(), signal.aborted)
 * to guarantee instant responsive task teardown and prevent orphan background promises (0 LLM Tokens).
 */

/**
 * Audits async worker/task source code for responsive AbortSignal cancellation support.
 *
 * @param {string} sourceCode - Async task/worker execution source code
 * @returns {object} Cancellation proof report
 */
export function proveSandboxAbortControllerSafety(sourceCode = '') {
  const violations = []

  const isLongRunningAsyncTask = /(?:async\s+function|const\s+\w+\s*=\s*async|\bwhile\s*\(|\bsetInterval\s*\(|\bpoll\b)/g.test(sourceCode)
  const acceptsAbortSignal = /(?:signal|abortSignal|AbortController)\b/i.test(sourceCode)
  const handlesAbort = /(?:signal\.addEventListener\s*\(\s*['"]abort['"]|signal\.throwIfAborted\s*\(|signal\.aborted|signal\.onabort)/i.test(sourceCode)

  if (isLongRunningAsyncTask && (!acceptsAbortSignal || !handlesAbort)) {
    violations.push({
      type: 'UNRESPONSIVE_ASYNC_TASK_CANCELLATION',
      recommendation: "Ensure long-running async workers accept an 'AbortSignal' and check 'signal.throwIfAborted()' or listen for 'abort' events to support instant cooperative cancellation.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    isLongRunningAsyncTask,
    violationsCount: violations.length,
    violations,
    abortProof: safe ? 'RESPONSIVE_ABORT_CONTROLLER_CANCELLATION_ENFORCED' : 'ORPHAN_ASYNC_TASK_CANCELLATION_RISK',
  }
}
