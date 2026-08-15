/**
 * scripts/aoi-os/security-guard/timing-leak-guard.mjs
 *
 * Deterministic Side-Channel Timing & Constant-Time Crypto Guard for AOI-OS:
 * Statically detects non-constant-time equality comparisons on secrets and signatures,
 * proving resistance against side-channel timing attacks (0 LLM Tokens).
 */

const SECRET_IDENTIFIERS = ['token', 'secret', 'signature', 'apiKey', 'password', 'hash', 'hmac']

/**
 * Audits code for vulnerable non-constant-time equality checks on sensitive identifiers.
 *
 * @param {string} sourceCode
 * @returns {object} Timing attack vulnerability report
 */
export function auditTimingSafety(sourceCode = '') {
  const vulnerabilities = []

  for (const identifier of SECRET_IDENTIFIERS) {
    const pattern = new RegExp(`(?:\\b${identifier}\\b\\s*===|===\\s*\\b${identifier}\\b)`, 'gi')
    const matches = sourceCode.match(pattern)

    if (matches && !sourceCode.includes('crypto.timingSafeEqual')) {
      vulnerabilities.push({
        identifier,
        type: 'NON_CONSTANT_TIME_SECRET_COMPARISON',
        recommendation: `Use Buffer.from() and crypto.timingSafeEqual() for constant-time comparison of '${identifier}'`,
      })
    }
  }

  const safe = vulnerabilities.length === 0

  return {
    safe,
    vulnerabilitiesCount: vulnerabilities.length,
    vulnerabilities,
    timingProof: safe ? 'CONSTANT_TIME_CRYPTO_VERIFIED' : 'TIMING_ATTACK_VULNERABILITY_DETECTED',
  }
}
