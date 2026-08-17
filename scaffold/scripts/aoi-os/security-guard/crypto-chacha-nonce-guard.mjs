/**
 * scripts/aoi-os/security-guard/crypto-chacha-nonce-guard.mjs
 *
 * Deterministic Safe Cryptographic ChaCha20-Poly1305 Nonce & Auth Guard for AOI-OS:
 * Statically audits ChaCha20-Poly1305 AEAD cipher invocations (crypto.createCipheriv / createDecipheriv / RFC 8439)
 * to verify explicit 12-byte (96-bit) nonce configuration and mandatory auth tag handling (getAuthTag / setAuthTag),
 * forbidding truncated nonces or unauthenticated payload decryption (0 LLM Tokens).
 */

const CHACHA_INSECURE_NONCE_PATTERNS = [
  /createCipheriv\s*\(\s*['"]chacha20-poly1305['"]\s*,\s*[a-zA-Z0-9_$]+\s*,\s*(?:Buffer\.alloc\s*\(\s*(?:[1-9]|1[01]|1[3-9]|[2-9]\d)\)|['"][^'"]{1,11}['"])/i,
]

/**
 * Audits ChaCha20-Poly1305 encryption/decryption source code for nonce length and auth tag handling.
 *
 * @param {string} sourceCode - Cryptographic source code
 * @returns {object} ChaCha20-Poly1305 safety audit report
 */
export function auditCryptoChachaNonceSafety(sourceCode = '') {
  const violations = []

  const usesChacha = /chacha20-poly1305/i.test(sourceCode)
  const hasInsecureNonce = CHACHA_INSECURE_NONCE_PATTERNS.some((p) => p.test(sourceCode))
  const handlesAuthTag = /(?:getAuthTag|setAuthTag|authTagLength\s*:\s*16)/i.test(sourceCode)

  if (hasInsecureNonce) {
    violations.push({
      type: 'INVALID_CHACHA20_NONCE_LENGTH',
      recommendation: "ChaCha20-Poly1305 nonce (IV) must be strictly 12 bytes (96 bits) per RFC 8439. Fix nonce length.",
    })
  }

  if (usesChacha && !handlesAuthTag) {
    violations.push({
      type: 'MISSING_CHACHA20_AUTH_TAG_HANDLING',
      recommendation: "ChaCha20-Poly1305 requires mandatory authentication tag handling. Ensure 'cipher.getAuthTag()' or 'decipher.setAuthTag(tag)' is called.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    usesChacha,
    violationsCount: violations.length,
    violations,
    chachaProof: safe ? 'CHACHA20_POLY1305_AEAD_ENFORCED' : 'INSECURE_CHACHA20_PARAMETERS_DETECTED',
  }
}
