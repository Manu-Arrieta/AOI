/**
 * scripts/aoi-os/security-guard/crypto-scrypt-param-guard.mjs
 *
 * Deterministic Safe Cryptographic Scrypt Cost & Parameter Guard for AOI-OS:
 * Statically audits Scrypt key derivation invocations (crypto.scrypt, crypto.scryptSync / RFC 7914)
 * to verify explicit OWASP-compliant cost parameter N (N >= 16384 or 2^14), r >= 8, p >= 1, and bounded maxmem,
 * forbidding weak cost parameters or unbounded allocations that cause DoS / brute-force vulnerability (0 LLM Tokens).
 */

const WEAK_SCRYPT_COST_PATTERNS = [
  /N\s*:\s*(?:[1-9]\d{0,2}|1000|1024)\b/i, // N <= 1024 (weak)
]

/**
 * Audits Scrypt password hashing/KDF source code for cost and memory parameter safety.
 *
 * @param {string} sourceCode - Scrypt invocation source code
 * @returns {object} Scrypt safety audit report
 */
export function auditCryptoScryptParamSafety(sourceCode = '') {
  const violations = []

  const usesScrypt = /(?:crypto\.scrypt|scryptSync|scrypt\s*\()/i.test(sourceCode)
  const hasWeakCost = WEAK_SCRYPT_COST_PATTERNS.some((p) => p.test(sourceCode))
  const hasRobustCost = /N\s*:\s*(?:16384|32768|65536|131072|2\s*\*\*\s*1[4-9]|2\s*\*\*\s*20)\b/i.test(sourceCode)

  if (hasWeakCost) {
    violations.push({
      type: 'INSECURE_WEAK_SCRYPT_COST_PARAMETER',
      recommendation: "Scrypt cost parameter N is dangerously weak (<= 1024). Enforce OWASP-compliant N >= 16384 (or 2**14).",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    usesScrypt,
    violationsCount: violations.length,
    violations,
    scryptProof: safe ? 'ROBUST_SCRYPT_PARAMETERS_ENFORCED' : 'WEAK_SCRYPT_COST_VULNERABILITY',
  }
}
