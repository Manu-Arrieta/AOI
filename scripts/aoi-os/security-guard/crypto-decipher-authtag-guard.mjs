/**
 * scripts/aoi-os/security-guard/crypto-decipher-authtag-guard.mjs
 *
 * Deterministic Safe Cryptographic Decipher AuthTag Order Guard for AOI-OS:
 * Statically audits authenticated decryption routines using crypto.createDecipheriv (GCM, CCM, OCB, ChaCha20-Poly1305)
 * to ensure decipher.setAuthTag(...) is strictly called before decipher.final(), preventing unauthenticated plaintext
 * leaks and runtime decipher failure exceptions (0 LLM Tokens).
 */

/**
 * Audits AEAD decryption source code for strict setAuthTag before final ordering.
 *
 * @param {string} sourceCode - Cryptographic decryption source code
 * @returns {object} Decipher auth tag ordering safety report
 */
export function auditCryptoDecipherAuthTagSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const isAeadDecipher = /(?:createDecipheriv\s*\(\s*['"][^'"]*(?:gcm|ccm|ocb|chacha20-poly1305)[^'"]*['"])/i.test(cleanCode)

  if (isAeadDecipher) {
    const hasSetAuthTag = /\.setAuthTag\s*\(/i.test(cleanCode)
    const hasFinal = /\.final\s*\(/i.test(cleanCode)

    if (!hasSetAuthTag) {
      violations.push({
        type: 'AEAD_DECIPHER_MISSING_SET_AUTH_TAG',
        recommendation: "Authenticated decipher (AEAD) initialized with crypto.createDecipheriv but lacks 'decipher.setAuthTag(authTag)'. AEAD decryption requires explicit authentication tag verification.",
      })
    } else if (hasFinal) {
      const setAuthTagIndex = cleanCode.indexOf('.setAuthTag')
      const finalIndex = cleanCode.indexOf('.final')

      if (finalIndex < setAuthTagIndex) {
        violations.push({
          type: 'AEAD_DECIPHER_SET_AUTH_TAG_AFTER_FINAL',
          recommendation: "decipher.final() was called before decipher.setAuthTag(). In Node.js AEAD decryption, setAuthTag() must strictly precede decipher.final() to verify ciphertext authenticity.",
        })
      }
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    isAeadDecipher,
    violationsCount: violations.length,
    violations,
    authTagOrderProof: safe ? 'AEAD_DECIPHER_AUTH_TAG_ORDER_VERIFIED' : 'OUT_OF_ORDER_AUTH_TAG_RISK',
  }
}
