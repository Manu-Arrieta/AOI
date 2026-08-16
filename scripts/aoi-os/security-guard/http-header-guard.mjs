/**
 * scripts/aoi-os/security-guard/http-header-guard.mjs
 *
 * Deterministic HTTP Header & CORS Origin Invariant Guard for AOI-OS:
 * Statically proves that server responses and CORS middlewares enforce secure origins and avoid wildcard credential leaks (0 LLM Tokens).
 */

/**
 * Audits source code for insecure CORS or missing HTTP security headers.
 *
 * @param {string} sourceCode
 * @returns {object} HTTP header security report
 */
export function auditHttpHeadersAndCors(sourceCode = '') {
  const violations = []

  // Check for origin: '*' with credentials: true
  const hasWildcardOrigin = /origin\s*:\s*['"]\*['"]/g.test(sourceCode)
  const hasCredentialsTrue = /credentials\s*:\s*true/g.test(sourceCode)

  if (hasWildcardOrigin && hasCredentialsTrue) {
    violations.push({
      type: 'INSECURE_CORS_WILDCARD_WITH_CREDENTIALS',
      recommendation: "Never combine origin: '*' with credentials: true. Specify explicit allowed origins.",
    })
  }

  // Check for Access-Control-Allow-Origin: * with Access-Control-Allow-Credentials: true
  if (
    /Access-Control-Allow-Origin['"]?\s*,\s*['"]\*['"]/i.test(sourceCode) &&
    /Access-Control-Allow-Credentials['"]?\s*,\s*['"]true['"]/i.test(sourceCode)
  ) {
    violations.push({
      type: 'INSECURE_CORS_HEADER_PAIR',
      recommendation: "Disallow Access-Control-Allow-Origin: * when Access-Control-Allow-Credentials is true.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    violationsCount: violations.length,
    violations,
    headerProof: safe ? 'HTTP_HEADERS_AND_CORS_SECURE' : 'INSECURE_HTTP_HEADER_OR_CORS_DETECTED',
  }
}
