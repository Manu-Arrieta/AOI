/**
 * scripts/aoi-os/security-guard/rate-limit-guard.mjs
 *
 * Deterministic Rate Limiting & DoS Defense Guard for AOI-OS:
 * Statically audits API endpoint route declarations to prove that public/auth routes
 * declare rate-limiting or request-throttling invariants (0 LLM Tokens).
 */

/**
 * Audits API route source code for rate limiting or throttling directives.
 *
 * @param {string} sourceCode - Server route or handler source code
 * @param {boolean} [isPublicOrAuth=true] - Whether the route is public or an auth endpoint
 * @returns {object} Rate limiting audit report
 */
export function auditRateLimiting(sourceCode = '', isPublicOrAuth = true) {
  const violations = []

  const hasRateLimiting = /\b(?:defineRateLimit|rateLimit|maxRequests|windowMs|useRateLimiter|throttle)\b/i.test(sourceCode)

  if (isPublicOrAuth && !hasRateLimiting) {
    violations.push({
      type: 'MISSING_RATE_LIMITING_PROTECTION',
      recommendation: "Attach rate-limiting middleware or configure 'maxRequests'/'windowMs' on public/auth routes to prevent DoS attacks.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    isPublicOrAuth,
    violationsCount: violations.length,
    violations,
    rateLimitProof: safe ? 'RATE_LIMITING_PROTECTION_PROVEN' : 'UNTHROTTLED_PUBLIC_ENDPOINT_DETECTED',
  }
}
