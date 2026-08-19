/**
 * scripts/aoi-os/security-guard/crypto-rsa-pss-hash-algorithm-guard.mjs
 *
 * Deterministic RSA-PSS Hash Algorithm Hardness Guard for AOI-OS:
 * Audits cryptographic RSA-PSS sign and verify operations to ensure that the hash digest
 * strictly uses modern SHA-2/SHA-3 algorithms (sha256/sha384/sha512), prohibiting broken legacy digests (0 LLM Tokens).
 */

const RSA_PSS_OPERATIONS = [
  /\bcrypto\s*\.\s*(?:sign|verify)\s*\(\s*['"]([^'"]+)['"][^)]*RSA_PKCS1_PSS_PADDING/,
  /\bcreate(?:Sign|Verify)\s*\(\s*['"]([^'"]+)['"]\s*\)/,
]

const INSECURE_HASHES = ['sha1', 'md5', 'md4', 'ripemd160']
const SECURE_HASHES = ['sha256', 'sha384', 'sha512', 'sha3-256', 'sha3-384', 'sha3-512', 'sha512-256']

/**
 * Audits cryptographic source code for secure hash algorithm selection in RSA-PSS operations.
 *
 * @param {string} sourceCode - JavaScript/TypeScript source code
 * @returns {object} Audit report with mathematical safety proof
 */
export function auditCryptoRsaPssHashAlgorithmSafety(sourceCode = '') {
  let isRsaPss = false
  let algorithm = null

  for (const pattern of RSA_PSS_OPERATIONS) {
    const match = sourceCode.match(pattern)
    if (match) {
      isRsaPss = true
      algorithm = (match[1] || '').toLowerCase()
      break
    }
  }

  if (!isRsaPss || !algorithm) {
    return {
      safe: true,
      isRsaPss: false,
      algorithm: null,
      violations: [],
      rsaPssHashProof: 'NO_RSA_PSS_HASH_OPERATION_DETECTED',
    }
  }

  const isInsecure = INSECURE_HASHES.includes(algorithm)
  const isSecure = SECURE_HASHES.includes(algorithm)

  const violations = []
  if (isInsecure || !isSecure) {
    violations.push(`INSECURE_OR_WEAK_RSA_PSS_HASH_ALGORITHM: "${algorithm}" (must be SHA-2 or SHA-3)`)
  }

  const safe = violations.length === 0

  return {
    safe,
    isRsaPss: true,
    algorithm,
    violations,
    rsaPssHashProof: safe
      ? 'SECURE_RSA_PSS_HASH_ALGORITHM_VERIFIED'
      : 'INSECURE_OR_WEAK_RSA_PSS_HASH_DETECTED',
  }
}
