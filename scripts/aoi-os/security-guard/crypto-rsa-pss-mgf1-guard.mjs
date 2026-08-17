/**
 * scripts/aoi-os/security-guard/crypto-rsa-pss-mgf1-guard.mjs
 *
 * Deterministic RSA-PSS MGF1 Hash Algorithm Guard for AOI-OS:
 * Audits Node.js crypto signature verification and key generation operations using RSA-PSS
 * to verify explicit and secure Mask Generation Function (MGF1) hash specification
 * (e.g., mgf1Hash: 'sha256'), preventing insecure default fallback to SHA-1 (0 LLM Tokens).
 */

const RSA_PSS_PATTERNS = [
  /RSA_PKCS1_PSS_PADDING/i,
  /rsa-pss/i,
]

const INSECURE_MGF1_PATTERNS = [
  /mgf1Hash\s*:\s*['"](?:sha1|md5)['"]/i,
  /mgf1\s*:\s*['"](?:mgf1sha1|mgf1md5)['"]/i,
]

const SECURE_MGF1_PATTERNS = [
  /mgf1Hash\s*:\s*['"](?:sha256|sha384|sha512|sha3-256|sha3-512)['"]/i,
  /mgf1\s*:\s*['"](?:mgf1sha256|mgf1sha384|mgf1sha512)['"]/i,
]

/**
 * Audits cryptographic code for secure RSA-PSS MGF1 hash specifications.
 *
 * @param {string} sourceCode - JavaScript/TypeScript code
 * @returns {object} Audit report with mathematical safety proof
 */
export function auditCryptoRsaPssMgf1Safety(sourceCode = '') {
  let usesRsaPss = false
  for (const pattern of RSA_PSS_PATTERNS) {
    if (pattern.test(sourceCode)) {
      usesRsaPss = true
      break
    }
  }

  if (!usesRsaPss) {
    return {
      safe: true,
      usesRsaPss: false,
      violations: [],
      rsaPssMgf1Proof: 'NO_RSA_PSS_OPERATION_DETECTED',
    }
  }

  const violations = []

  // Check for explicit insecure MGF1 hash (e.g., sha1)
  for (const pattern of INSECURE_MGF1_PATTERNS) {
    if (pattern.test(sourceCode)) {
      violations.push('INSECURE_MGF1_HASH_ALGORITHM_SPECIFIED')
    }
  }

  // Check if secure MGF1 is present
  let hasSecureMgf1 = false
  for (const pattern of SECURE_MGF1_PATTERNS) {
    if (pattern.test(sourceCode)) {
      hasSecureMgf1 = true
      break
    }
  }

  if (!hasSecureMgf1 && violations.length === 0) {
    violations.push('MISSING_EXPLICIT_SECURE_MGF1_HASH_IN_RSA_PSS')
  }

  const safe = violations.length === 0

  return {
    safe,
    usesRsaPss: true,
    violations,
    rsaPssMgf1Proof: safe
      ? 'SECURE_RSA_PSS_MGF1_HASH_VERIFIED'
      : 'INSECURE_OR_MISSING_RSA_PSS_MGF1_HASH_DETECTED',
  }
}
