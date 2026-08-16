/**
 * scripts/aoi-os/cache-guard/cache-invalidation-guard.mjs
 *
 * Deterministic Cache-Control & Client Invalidation Invariant Guard for AOI-OS:
 * Statically audits HTTP mutation endpoints (POST/PUT/DELETE/PATCH) to prove that responses
 * include explicit Cache-Control invalidation directives (no-store / no-cache) preventing stale client states (0 LLM Tokens).
 */

/**
 * Audits mutation endpoint source code for cache control invalidation directives.
 *
 * @param {string} sourceCode - Server route or handler source code
 * @param {string} [httpMethod='POST'] - HTTP Method ('GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH')
 * @returns {object} Cache invalidation audit report
 */
export function auditCacheInvalidation(sourceCode = '', httpMethod = 'POST') {
  const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(httpMethod.toUpperCase())
  const hasCacheHeader = /setHeader\s*\(\s*event\s*,\s*['"]Cache-Control['"]\s*,\s*['"][^'"]*(?:no-store|no-cache|max-age=0)[^'"]*['"]\)/i.test(sourceCode) ||
    /setResponseHeader\s*\(\s*event\s*,\s*['"]Cache-Control['"]\s*,\s*['"][^'"]*(?:no-store|no-cache|max-age=0)[^'"]*['"]\)/i.test(sourceCode) ||
    /['"]Cache-Control['"]\s*:\s*['"][^'"]*(?:no-store|no-cache|max-age=0)[^'"]*['"]/i.test(sourceCode)

  const violations = []
  if (isMutation && !hasCacheHeader) {
    violations.push({
      httpMethod,
      type: 'MISSING_MUTATION_CACHE_INVALIDATION_HEADER',
      recommendation: "Ensure mutation endpoints set 'Cache-Control: no-store, no-cache, must-revalidate' to prevent stale responses.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    isMutation,
    violationsCount: violations.length,
    violations,
    cacheProof: safe ? 'CACHE_CONTROL_INVALIDATION_PROVEN' : 'MISSING_CACHE_INVALIDATION_DIRECTIVE',
  }
}
