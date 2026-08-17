/**
 * scripts/aoi-os/security-guard/crypto-key-pair-curve-guard.mjs
 *
 * Deterministic Safe Cryptographic Key Pair Generation Curve & Modulus Guard for AOI-OS:
 * Statically audits crypto.generateKeyPair and crypto.generateKeyPairSync calls to verify that
 * asymmetric key generation uses robust modern curves (ed25519, ed448, x25519, x448, prime256v1, secp384r1)
 * and RSA modulus >= 2048 bits, forbidding insecure legacy curves (< 256 bits) (0 LLM Tokens).
 */

const WEAK_KEYPAIR_CURVES = [
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
  'sect113r2',
  'sect131r1',
  'sect131r2',
  'sect163k1',
  'sect163r1',
  'sect163r2',
  'sect193r1',
  'sect193r2',
]

/**
 * Audits key pair generation source code for curve hardness and key size safety.
 *
 * @param {string} sourceCode - Key pair generation source code
 * @returns {object} Key pair generation safety audit report
 */
export function auditCryptoKeyPairSafety(sourceCode = '') {
  const violations = []

  const generatesKeyPair = /(?:generateKeyPair|generateKeyPairSync)\s*\(/i.test(sourceCode)

  if (generatesKeyPair) {
    for (const weakCurve of WEAK_KEYPAIR_CURVES) {
      const weakRegex = new RegExp(`['"]${weakCurve}['"]`, 'i')
      if (weakRegex.test(sourceCode)) {
        violations.push({
          type: 'WEAK_KEYPAIR_CURVE',
          curve: weakCurve,
          recommendation: `generateKeyPair specifies weak curve '${weakCurve}' (< 256 bits). Use modern curves like 'ed25519', 'x25519', 'prime256v1', or 'secp384r1'.`,
        })
      }
    }

    const rsaModulusMatch = /modulusLength\s*:\s*(\d+)/i.exec(sourceCode)
    if (rsaModulusMatch) {
      const length = Number.parseInt(rsaModulusMatch[1], 10)
      if (length < 2048) {
        violations.push({
          type: 'INSECURE_RSA_KEYPAIR_MODULUS',
          length,
          recommendation: `RSA modulusLength (${length} bits) is insecure. Specify at least 2048 (or 3072/4096) bits for robust security.`,
        })
      }
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    generatesKeyPair,
    violationsCount: violations.length,
    violations,
    keyPairProof: safe ? 'KEYPAIR_PARAMETERS_CANONICAL' : 'INSECURE_KEYPAIR_PARAMETERS_DETECTED',
  }
}
