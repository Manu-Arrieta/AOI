/**
 * scripts/aoi-os/security-guard/crypto-rsa-key-length-guard.mjs
 *
 * Deterministic Safe Cryptographic RSA Key Minimum Modulus Length Guard for AOI-OS:
 * Statically audits asymmetric RSA key generation options (crypto.generateKeyPair, generateKeyPairSync, modulusLength)
 * to verify that RSA modulus length is explicitly enforced to >= 2048 bits and forbids insecure legacy key lengths
 * (512, 1024 bits) (0 LLM Tokens).
 */

const WEAK_RSA_LENGTHS = [
  /modulusLength\s*:\s*(?:512|1024)\b/i,
]

/**
 * Audits RSA key generation source code for minimum modulus length safety.
 *
 * @param {string} sourceCode - RSA key generation source code
 * @returns {object} RSA key length audit report
 */
export function auditCryptoRsaKeyLengthSafety(sourceCode = '') {
  const violations = []

  const generatesRsaKeys = /(?:generateKeyPair|generateKeyPairSync)\s*\(\s*['"]rsa['"]/i.test(sourceCode)
  const hasWeakModulus = WEAK_RSA_LENGTHS.some((p) => p.test(sourceCode))
  const hasRobustModulus = /modulusLength\s*:\s*(?:2048|3072|4096)\b/i.test(sourceCode)

  if (hasWeakModulus) {
    violations.push({
      type: 'INSECURE_WEAK_RSA_MODULUS_LENGTH',
      recommendation: "RSA key modulus length is below modern security standards (< 2048 bits). Enforce 'modulusLength: 2048' or higher (recommended 3072/4096 bits).",
    })
  } else if (generatesRsaKeys && !hasRobustModulus) {
    violations.push({
      type: 'UNSPECIFIED_RSA_MODULUS_LENGTH',
      recommendation: "Explicitly declare 'modulusLength: 2048' or higher in RSA key generation options.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    generatesRsaKeys,
    violationsCount: violations.length,
    violations,
    rsaProof: safe ? 'ROBUST_RSA_MODULUS_LENGTH_ENFORCED' : 'INSECURE_RSA_KEY_LENGTH_VULNERABILITY',
  }
}
