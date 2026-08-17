/**
 * scripts/aoi-os/security-guard/crypto-ecdh-curve-guard.mjs
 *
 * Deterministic Safe Cryptographic ECDH Curve Hardness Guard for AOI-OS:
 * Statically audits ECDH key agreement invocations (crypto.createECDH / crypto.diffieHellman)
 * to enforce robust modern curves (x25519, x448, prime256v1, secp384r1, secp521r1) and forbid
 * weak legacy curves (< 256 bits like secp112r1, secp128r1, secp160r1, secp192r1) (0 LLM Tokens).
 */

const WEAK_ECDH_CURVES = [
  'secp112r1',
  'secp112r2',
  'secp128r1',
  'secp128r2',
  'secp160k1',
  'secp160r1',
  'secp160r2',
  'secp192k1',
  'secp192r1',
  'sect113r1',
  'sect131r1',
  'sect163k1',
  'sect163r1',
  'sect193r1',
  'c2pnb163v1',
  'c2pnb176w1',
  'c2tnb191v1',
]

/**
 * Audits ECDH curve declarations in source code for cryptographic hardness.
 *
 * @param {string} sourceCode - Cryptographic source code
 * @returns {object} ECDH curve safety audit report
 */
export function auditCryptoEcdhCurveSafety(sourceCode = '') {
  const violations = []

  const usesEcdh = /(?:createECDH|diffieHellman)\s*\(/i.test(sourceCode)

  for (const weakCurve of WEAK_ECDH_CURVES) {
    const weakRegex = new RegExp(`(?:createECDH|diffieHellman)\\s*\\(\\s*['"]${weakCurve}['"]`, 'i')
    if (weakRegex.test(sourceCode)) {
      violations.push({
        type: 'WEAK_ECDH_CURVE_DECLARED',
        curve: weakCurve,
        recommendation: `ECDH curve '${weakCurve}' has insufficient bit security (<256 bits). Upgrade to modern Montgomery curve 'x25519'/'x448' or NIST 'prime256v1'/'secp384r1'.`,
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    usesEcdh,
    violationsCount: violations.length,
    violations,
    ecdhProof: safe ? 'ECDH_CURVE_HARDNESS_ENFORCED' : 'WEAK_ECDH_CURVE_RISK_DETECTED',
  }
}
