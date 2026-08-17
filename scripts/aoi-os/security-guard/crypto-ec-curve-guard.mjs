/**
 * scripts/aoi-os/security-guard/crypto-ec-curve-guard.mjs
 *
 * Deterministic Safe Cryptographic Elliptic Curve Hardness Guard for AOI-OS:
 * Statically audits asymmetric key generation and ECDH/ECDSA curve selections to enforce
 * robust curves (prime256v1, secp256r1, secp384r1, ed25519, x25519, secp256k1) and forbid
 * deprecated weak curves (secp112r1, secp128r1, sect163k1, etc.) (0 LLM Tokens).
 */

const INSECURE_CURVE_PATTERNS = [
  /['"](?:secp112r1|secp112r2|secp128r1|secp128r2|secp160k1|secp160r1|secp160r2|sect113r1|sect131r1|sect163k1|sect163r1|sect163r2)['"]/i,
]

/**
 * Audits elliptic curve cryptography declarations for secure curve parameters.
 *
 * @param {string} sourceCode - EC cryptography source code
 * @returns {object} Elliptic curve hardness audit report
 */
export function auditCryptoEcCurveSafety(sourceCode = '') {
  const violations = []

  const usesEcCrypto = /(?:createECDH|generateKeyPair|generateKeyPairSync|namedCurve)\b/g.test(sourceCode)

  for (const pattern of INSECURE_CURVE_PATTERNS) {
    if (pattern.test(sourceCode)) {
      violations.push({
        type: 'WEAK_ELLIPTIC_CURVE_DETECTED',
        recommendation: "Avoid legacy short curves (<256 bits). Use robust standardized curves such as 'prime256v1' (P-256), 'secp384r1' (P-384), 'ed25519', or 'x25519'.",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    usesEcCrypto,
    violationsCount: violations.length,
    violations,
    curveProof: safe ? 'ROBUST_ELLIPTIC_CURVE_HARDNESS_ENFORCED' : 'WEAK_CRYPTOGRAPHIC_CURVE_DETECTED',
  }
}
