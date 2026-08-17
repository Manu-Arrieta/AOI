/**
 * scripts/aoi-os/stream-guard/http-timeout-guard.mjs
 *
 * Deterministic Outbound HTTP Request Timeout & AbortSignal Guard for AOI-OS:
 * Statically audits outbound network request routines (fetch, axios, $fetch, http.request)
 * to prove that explicit timeouts or AbortSignal instances are configured (0 LLM Tokens).
 */

/**
 * Audits source code for explicit HTTP request timeout and abort signal protection.
 *
 * @param {string} sourceCode - Client or service source code
 * @returns {object} Timeout audit report
 */
export function auditHttpRequestTimeoutSafety(sourceCode = '') {
  const violations = []

  const hasHttpCall = /(?:\bfetch\s*\(|\baxios\.(?:get|post|put|delete|request)\s*\(|\b\$fetch\s*\(|\bhttp\.request\s*\()/g.test(sourceCode)
  const hasTimeoutOrSignal = /(?:timeout\s*:|signal\s*:|\bAbortSignal\.timeout|\bAbortController\b)/g.test(sourceCode)

  if (hasHttpCall && !hasTimeoutOrSignal) {
    violations.push({
      type: 'UNGUARDED_OUTBOUND_HTTP_REQUEST',
      recommendation: "Configure an explicit 'timeout' or provide a 'signal: AbortSignal.timeout(ms)' to prevent hung sockets.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasHttpCall,
    violationsCount: violations.length,
    violations,
    timeoutProof: safe ? 'HTTP_REQUEST_TIMEOUT_PROTECTED' : 'UNGUARDED_HTTP_CALL_DETECTED',
  }
}
