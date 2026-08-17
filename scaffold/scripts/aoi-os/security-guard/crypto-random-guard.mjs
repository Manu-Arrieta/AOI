/**
 * scripts/aoi-os/security-guard/crypto-random-guard.mjs
 *
 * Deterministic Safe Cryptographic Randomness (CSPRNG) Guard for AOI-OS:
 * Statically audits security-sensitive token, session ID, and secret generation routines
 * to ensure that pseudo-random generators (Math.random()) are prohibited in favor of CSPRNG (crypto.randomBytes, crypto.randomUUID) (0 LLM Tokens).
 */

/**
 * Audits source code for use of non-cryptographic pseudo-randomness in security contexts.
 *
 * @param {string} sourceCode - Token or secret generator source code
 * @returns {object} Randomness safety report
 */
export function auditCryptoRandomSafety(sourceCode = '') {
  const violations = []

  const isSecurityOrTokenContext = /(?:generateToken|createSecret|generateSession|createNonce|generateApiKey|generateId)\b/i.test(sourceCode)
  const usesMathRandom = /\bMath\.random\s*\(\s*\)/g.test(sourceCode)

  if (isSecurityOrTokenContext && usesMathRandom) {
    violations.push({
      type: 'INSECURE_PSEUDO_RANDOMNESS_IN_SECURITY_CONTEXT',
      recommendation: "Replace 'Math.random()' with cryptographically secure PRNG like 'crypto.randomBytes()' or 'crypto.randomUUID()'.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    isSecurityOrTokenContext,
    violationsCount: violations.length,
    violations,
    randomProof: safe ? 'CSPRNG_RANDOMNESS_ENFORCED' : 'INSECURE_PSEUDORANDOM_TOKEN_RISK',
  }
}
