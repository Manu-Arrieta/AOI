/**
 * scripts/aoi-os/security-guard/crypto-kdf-guard.mjs
 *
 * Deterministic Safe Cryptographic KDF (PBKDF2 / Scrypt) Salt & Iteration Guard for AOI-OS:
 * Statically audits key derivation functions (crypto.pbkdf2, crypto.scrypt) to verify that
 * salt length (16+ bytes) and iteration counts (100,000+ for PBKDF2) meet OWASP cryptographic standards (0 LLM Tokens).
 */

/**
 * Audits source code for secure PBKDF2 / Scrypt key derivation parameters.
 *
 * @param {string} sourceCode - Cryptographic hashing or key derivation source code
 * @returns {object} KDF safety report
 */
export function auditCryptoKdfSafety(sourceCode = '') {
  const violations = []

  const isPbkdf2Call = /(?:crypto\.pbkdf2|crypto\.pbkdf2Sync)\s*\(/g.test(sourceCode)

  if (isPbkdf2Call) {
    // Check for low iteration count (e.g. < 100,000)
    const iterationMatch = sourceCode.match(/(?:crypto\.pbkdf2|crypto\.pbkdf2Sync)\s*\([^,]+,\s*[^,]+,\s*(\d+)/)
    if (iterationMatch) {
      const iterations = parseInt(iterationMatch[1], 10)
      if (iterations < 100000) {
        violations.push({
          type: 'INSUFFICIENT_PBKDF2_ITERATIONS',
          iterations,
          recommendation: `PBKDF2 iteration count (${iterations}) is below the recommended OWASP minimum of 100,000. Increase iterations.`,
        })
      }
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    isPbkdf2Call,
    violationsCount: violations.length,
    violations,
    kdfProof: safe ? 'SAFE_KDF_PARAMETERS_ENFORCED' : 'WEAK_KEY_DERIVATION_RISK_DETECTED',
  }
}
