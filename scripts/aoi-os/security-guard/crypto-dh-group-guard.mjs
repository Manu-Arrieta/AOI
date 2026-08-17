/**
 * scripts/aoi-os/security-guard/crypto-dh-group-guard.mjs
 *
 * Deterministic Safe Cryptographic Diffie-Hellman Group & Prime Length Guard for AOI-OS:
 * Statically audits Diffie-Hellman key exchange declarations (crypto.createDiffieHellman, crypto.getDiffieHellman)
 * to verify that DH prime length is explicitly enforced to >= 2048 bits or standardized RFC 3526 MODP groups (modp14+),
 * forbidding insecure legacy groups (512, 768, 1024 bits / modp1, modp2, modp5) susceptible to Logjam attacks (0 LLM Tokens).
 */

const WEAK_DH_PATTERNS = [
  /createDiffieHellman\s*\(\s*(?:512|768|1024)\b/i,
  /getDiffieHellman\s*\(\s*['"](?:modp1|modp2|modp5)['"]\s*\)/i,
]

/**
 * Audits Diffie-Hellman group initialization source code for cryptographic hardness.
 *
 * @param {string} sourceCode - DH initialization source code
 * @returns {object} DH group audit report
 */
export function auditCryptoDhGroupSafety(sourceCode = '') {
  const violations = []

  const usesDiffieHellman = /(?:createDiffieHellman|getDiffieHellman)\s*\(/i.test(sourceCode)
  const hasWeakDhGroup = WEAK_DH_PATTERNS.some((p) => p.test(sourceCode))
  const hasRobustDhGroup = /(?:createDiffieHellman\s*\(\s*(?:2048|3072|4096)\b|getDiffieHellman\s*\(\s*['"](?:modp14|modp15|modp16|modp17|modp18)['"]\s*\))/i.test(sourceCode)

  if (hasWeakDhGroup) {
    violations.push({
      type: 'INSECURE_WEAK_DH_GROUP',
      recommendation: "Diffie-Hellman prime length/group is below modern security standards (< 2048 bits / legacy MODP). Enforce prime length >= 2048 bits or use standardized RFC 3526 MODP groups ('modp14', 'modp15').",
    })
  } else if (usesDiffieHellman && !hasRobustDhGroup) {
    violations.push({
      type: 'UNVERIFIED_DH_GROUP_PARAMETERS',
      recommendation: "Explicitly declare primeLength >= 2048 or a standardized robust MODP group ('modp14', 'modp15') in Diffie-Hellman initialization.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    usesDiffieHellman,
    violationsCount: violations.length,
    violations,
    dhProof: safe ? 'ROBUST_DH_GROUP_ENFORCED' : 'INSECURE_DH_GROUP_VULNERABILITY',
  }
}
