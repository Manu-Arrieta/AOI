/**
 * scripts/aoi-os/security-guard/crypto-pbkdf2-digest-guard.mjs
 *
 * Deterministic Safe Cryptographic PBKDF2 Digest Algorithm Hardness Guard for AOI-OS:
 * Statically audits crypto.pbkdf2 and crypto.pbkdf2Sync invocations to verify that the digest algorithm
 * is explicitly declared using modern secure hashes (sha256, sha384, sha512) and forbids vulnerable
 * legacy digests (sha1, md5) (0 LLM Tokens).
 */

const WEAK_PBKDF2_DIGESTS = [
  /['"](?:sha1|md5|rmd160)['"]/i,
]

const STRONG_PBKDF2_DIGESTS = [
  /['"](?:sha256|sha384|sha512|sha3-256|sha3-512)['"]/i,
]

/**
 * Audits PBKDF2 key derivation calls for secure digest algorithm specification.
 *
 * @param {string} sourceCode - Key derivation source code
 * @returns {object} PBKDF2 digest audit report
 */
export function auditCryptoPbkdf2DigestSafety(sourceCode = '') {
  const violations = []

  const usesPbkdf2 = /(?:crypto\.pbkdf2|crypto\.pbkdf2Sync|pbkdf2\(|pbkdf2Sync\()\s*\(/g.test(sourceCode)
  const specifiesWeakDigest = WEAK_PBKDF2_DIGESTS.some((p) => p.test(sourceCode))
  const specifiesStrongDigest = STRONG_PBKDF2_DIGESTS.some((p) => p.test(sourceCode))

  if (specifiesWeakDigest) {
    violations.push({
      type: 'INSECURE_PBKDF2_WEAK_DIGEST',
      recommendation: "Avoid legacy SHA-1 or MD5 digests in PBKDF2. Use 'sha256' or 'sha512' for robust collision resistance.",
    })
  } else if (usesPbkdf2 && !specifiesStrongDigest) {
    violations.push({
      type: 'UNSPECIFIED_PBKDF2_DIGEST',
      recommendation: "Explicitly specify a robust digest algorithm ('sha256' or 'sha512') in PBKDF2 parameters.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    usesPbkdf2,
    violationsCount: violations.length,
    violations,
    digestProof: safe ? 'ROBUST_PBKDF2_DIGEST_ENFORCED' : 'WEAK_PBKDF2_DIGEST_VULNERABILITY_RISK',
  }
}
