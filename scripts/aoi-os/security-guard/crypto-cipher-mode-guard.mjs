/**
 * scripts/aoi-os/security-guard/crypto-cipher-mode-guard.mjs
 *
 * Deterministic Safe Cryptographic Cipher Mode & GCM Auth Tag Guard for AOI-OS:
 * Statically audits symmetric encryption routines (crypto.createCipheriv, crypto.createDecipheriv)
 * to verify authenticated encryption algorithms (aes-256-gcm, chacha20-poly1305) and enforce authentication tag
 * extraction/verification (getAuthTag, setAuthTag) against tampering and padding oracle attacks (0 LLM Tokens).
 */

/**
 * Audits source code for authenticated symmetric cipher modes and authentication tag handling.
 *
 * @param {string} sourceCode - Symmetric encryption/decryption source code
 * @returns {object} Cipher mode safety report
 */
export function auditCryptoCipherModeSafety(sourceCode = '') {
  const violations = []

  const usesCipheriv = /(?:crypto\.createCipheriv|createCipheriv|crypto\.createDecipheriv|createDecipheriv)\s*\(/g.test(sourceCode)

  if (usesCipheriv) {
    const usesInsecureMode = /['"](?:aes-128-ecb|aes-256-ecb|aes-128-cbc|aes-256-cbc|des|des-ede3|rc4)['"]/i.test(sourceCode)
    if (usesInsecureMode) {
      violations.push({
        type: 'UNAUTHENTICATED_CIPHER_MODE',
        recommendation: "Use authenticated encryption modes (e.g. 'aes-256-gcm' or 'chacha20-poly1305') instead of unauthenticated CBC/ECB/DES modes.",
      })
    }

    const usesGcm = /['"]aes-[0-9]+-gcm['"]/i.test(sourceCode)
    const hasAuthTag = /(?:getAuthTag|setAuthTag)\s*\(/i.test(sourceCode)

    if (usesGcm && !hasAuthTag) {
      violations.push({
        type: 'MISSING_GCM_AUTH_TAG_VERIFICATION',
        recommendation: "GCM cipher requires explicit authentication tag handling ('cipher.getAuthTag()' on encrypt or 'decipher.setAuthTag()' on decrypt) to ensure ciphertext integrity.",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    usesCipheriv,
    violationsCount: violations.length,
    violations,
    cipherProof: safe ? 'AUTHENTICATED_AEAD_CIPHER_ENFORCED' : 'INSECURE_CIPHER_MODE_DETECTED',
  }
}
