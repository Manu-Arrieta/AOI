/**
 * scripts/aoi-os/security-guard/crypto-algorithm-guard.mjs
 *
 * Deterministic Safe Cryptographic Algorithm Guard for AOI-OS:
 * Statically audits cryptographic routines (createHash, createHmac, createCipheriv) to verify
 * that broken legacy algorithms (md5, sha1, des, rc4) are prohibited in favor of robust standards (0 LLM Tokens).
 */

/**
 * Audits source code for use of deprecated/broken cryptographic algorithms.
 *
 * @param {string} sourceCode - Cryptographic service source code
 * @returns {object} Crypto algorithm audit report
 */
export function auditCryptoAlgorithmSafety(sourceCode = '') {
  const violations = []

  const legacyAlgorithmMatches = sourceCode.match(/(?:createHash|createHmac|createCipher|createCipheriv)\s*\(\s*['"](md5|sha1|des|rc4)['"]/gi)

  if (legacyAlgorithmMatches && legacyAlgorithmMatches.length > 0) {
    for (const match of legacyAlgorithmMatches) {
      violations.push({
        type: 'INSECURE_LEGACY_CRYPTO_ALGORITHM',
        matched: match,
        recommendation: "Upgrade insecure legacy algorithm ('md5'/'sha1'/'des') to 'sha256', 'sha512', or 'aes-256-gcm'.",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    violationsCount: violations.length,
    violations,
    cryptoProof: safe ? 'SAFE_CRYPTO_ALGORITHMS_ENFORCED' : 'INSECURE_LEGACY_CRYPTO_DETECTED',
  }
}
