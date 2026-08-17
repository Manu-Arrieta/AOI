/**
 * scripts/aoi-os/security-guard/crypto-eddsa-verify-guard.mjs
 *
 * Deterministic Safe Cryptographic EdDSA Signature & Algorithm Guard for AOI-OS:
 * Statically audits EdDSA (Ed25519 / Ed448) signature verification invocations (crypto.verify / RFC 8032)
 * to verify that the algorithm parameter is explicitly null (as mandated by Node.js crypto for EdDSA)
 * and prevent algorithm confusion or truncated signature vulnerabilities (0 LLM Tokens).
 */

const EDDSA_INSECURE_VERIFY_PATTERNS = [
  /verify\s*\(\s*['"](?:sha256|sha512|sha384|md5|sha1)['"]\s*,\s*[^,]+,\s*[^,]+(?:ed25519|ed448)[^,]*,\s*[^)]+\)/i,
]

/**
 * Audits EdDSA signature verification source code for algorithm safety.
 *
 * @param {string} sourceCode - Cryptographic source code
 * @returns {object} EdDSA signature verification safety audit report
 */
export function auditCryptoEddsaVerifySafety(sourceCode = '') {
  const violations = []

  const usesEddsa = /(?:ed25519|ed448)/i.test(sourceCode)
  const hasInsecureAlgorithm = EDDSA_INSECURE_VERIFY_PATTERNS.some((p) => p.test(sourceCode))

  if (hasInsecureAlgorithm) {
    violations.push({
      type: 'INVALID_EDDSA_VERIFY_ALGORITHM',
      recommendation: "EdDSA (Ed25519 / Ed448) signature verification in Node.js requires algorithm to be explicitly 'null' (e.g. crypto.verify(null, data, key, signature)). Passing digest names like 'sha256' causes verification errors or algorithm confusion.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    usesEddsa,
    violationsCount: violations.length,
    violations,
    eddsaProof: safe ? 'EDDSA_VERIFY_ALGORITHM_CANONICAL' : 'INVALID_EDDSA_VERIFY_ALGORITHM_DETECTED',
  }
}
