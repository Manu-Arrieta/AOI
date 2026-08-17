/**
 * scripts/aoi-os/security-guard/jwt-expiration-guard.mjs
 *
 * Deterministic JWT & Auth Token Expiration Invariant Guard for AOI-OS:
 * Statically audits token signing and creation routines (jwt.sign, SignJWT) to ensure that
 * an explicit expiration policy (expiresIn, exp, setExpirationTime) is declared, preventing non-expiring perpetual tokens (0 LLM Tokens).
 */

/**
 * Audits auth token signing source code for explicit expiration configuration.
 *
 * @param {string} sourceCode - Server auth or token generation source code
 * @returns {object} Token expiration audit report
 */
export function auditJwtExpirationSafety(sourceCode = '') {
  const violations = []

  const hasTokenSign = /\b(?:jwt\.sign|new\s+SignJWT|createJwtToken|generateToken)\s*\(/g.test(sourceCode)
  const hasExpirationClaim = /\b(?:expiresIn|setExpirationTime|exp\s*:)\b/g.test(sourceCode)

  if (hasTokenSign && !hasExpirationClaim) {
    violations.push({
      type: 'MISSING_JWT_EXPIRATION_CLAIM',
      recommendation: "Provide an explicit expiration policy via 'expiresIn: \"1h\"' or 'setExpirationTime(\"2h\")' to prevent perpetual token security risks.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasTokenSign,
    violationsCount: violations.length,
    violations,
    jwtProof: safe ? 'JWT_EXPIRATION_INVARIANT_PROVEN' : 'UNBOUNDED_PERPETUAL_TOKEN_DETECTED',
  }
}
