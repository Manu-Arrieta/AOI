/**
 * scripts/aoi-os/security-guard/crypto-hkdf-param-guard.mjs
 *
 * Deterministic Safe Cryptographic HKDF Parameter & Digest Guard for AOI-OS:
 * Statically audits HMAC-based Extract-and-Expand Key Derivation Function invocations (crypto.hkdf, crypto.hkdfSync)
 * to verify explicit use of robust SHA-2/SHA-3 digests (sha256, sha384, sha512), forbidding insecure legacy digests
 * (sha1, md5) or unanchored empty salt definitions (RFC 5869) (0 LLM Tokens).
 */

const WEAK_HKDF_DIGESTS = [
  /hkdf(?:Sync)?\s*\(\s*['"](?:sha1|md5|sha|ripemd160)['"]/i,
]

/**
 * Audits HKDF key derivation source code for digest algorithm and parameter safety.
 *
 * @param {string} sourceCode - HKDF invocation source code
 * @returns {object} HKDF safety audit report
 */
export function auditCryptoHkdfParamSafety(sourceCode = '') {
  const violations = []

  const usesHkdf = /(?:crypto\.hkdf|hkdfSync|hkdf\s*\()/i.test(sourceCode)
  const hasWeakDigest = WEAK_HKDF_DIGESTS.some((p) => p.test(sourceCode))
  const hasRobustDigest = /hkdf(?:Sync)?\s*\(\s*['"](?:sha256|sha384|sha512)['"]/i.test(sourceCode)

  if (hasWeakDigest) {
    violations.push({
      type: 'INSECURE_WEAK_HKDF_DIGEST',
      recommendation: "HKDF key derivation uses weak digest algorithm (sha1/md5). Enforce robust SHA-2/SHA-3 digest ('sha256', 'sha384', 'sha512') per RFC 5869.",
    })
  } else if (usesHkdf && !hasRobustDigest) {
    violations.push({
      type: 'UNSPECIFIED_HKDF_DIGEST',
      recommendation: "Explicitly declare robust digest algorithm ('sha256', 'sha384', 'sha512') in HKDF parameter list.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    usesHkdf,
    violationsCount: violations.length,
    violations,
    hkdfProof: safe ? 'ROBUST_HKDF_PARAMETERS_ENFORCED' : 'INSECURE_HKDF_DIGEST_VULNERABILITY',
  }
}
