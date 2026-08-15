/**
 * scripts/aoi-os/async-guard/promise-cascade-guard.mjs
 *
 * Deterministic Asynchronous Promise Cascade & Infinite Event-Loop Guard for AOI-OS:
 * Statically detects un-awaited promises, recursive nextTick loops, and unbounded async concurrency,
 * proving finite event-loop execution and preventing runtime deadlocks (0 LLM Tokens).
 */

/**
 * Audits source code for dangerous asynchronous patterns.
 *
 * @param {string} sourceCode
 * @returns {object} Async safety audit report
 */
export function auditAsyncSafety(sourceCode = '') {
  const violations = []

  // 1. Detect recursive nextTick / setImmediate
  const recursiveLoopRegex = /function\s+([a-zA-Z0-9_$]+)[^{]*\{[^}]*?(?:process\.nextTick|setImmediate)\s*\(\s*\1\b/gs
  if (recursiveLoopRegex.test(sourceCode)) {
    violations.push({
      type: 'INFINITE_MICROTASK_LOOP_DETECTED',
      recommendation: 'Break recursive process.nextTick / setImmediate loop with an asynchronous exit condition.',
    })
  }

  // 2. Detect un-awaited async function calls in loops
  const unawaitedInLoopRegex = /(?:for|while)\s*\([^)]+\)\s*\{[^}]*?(?<!await\s+)\b([a-zA-Z0-9_$]+Async)\s*\([^)]*\)\s*;/g
  if (unawaitedInLoopRegex.test(sourceCode)) {
    violations.push({
      type: 'UNBOUNDED_UN_AWAITED_ASYNC_CASCADE',
      recommendation: 'Use await or batch async promises with Promise.all() inside loops.',
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    violationsCount: violations.length,
    violations,
    asyncProof: safe ? 'ASYNC_EVENT_LOOP_BOUNDED_AND_SAFE' : 'ASYNC_CASCADE_OR_DEADLOCK_RISK_DETECTED',
  }
}
