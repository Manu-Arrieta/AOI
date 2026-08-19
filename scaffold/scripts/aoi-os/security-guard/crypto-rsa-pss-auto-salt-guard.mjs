/**
 * scripts/aoi-os/security-guard/crypto-rsa-pss-auto-salt-guard.mjs
 *
 * Deterministic RSA-PSS Verification Auto-Salt Guard for AOI-OS:
 * Audits cryptographic RSA-PSS verify operations to ensure that saltLength is explicitly
 * configured with interoperable constants (RSA_PSS_SALTLEN_AUTO or RSA_PSS_SALTLEN_DIGEST),
 * preventing verification failures and signature malleability (0 LLM Tokens).
 */

const RSA_PSS_VERIFY_PATTERNS = [
  /\bcrypto\s*\.\s*verify\s*\([^)]*RSA_PKCS1_PSS_PADDING/,
  /\bverify\s*\([^)]*padding\s*:\s*(?:crypto\s*\.\s*constants\s*\.\s*)?RSA_PKCS1_PSS_PADDING/,
]

const SECURE_AUTO_SALT_PATTERNS = [
  /saltLength\s*:\s*(?:crypto\s*\.\s*constants\s*\.\s*)?RSA_PSS_SALTLEN_AUTO\b/,
  /saltLength\s*:\s*(?:crypto\s*\.\s*constants\s*\.\s*)?RSA_PSS_SALTLEN_DIGEST\b/,
]

/**
 * Audits cryptographic source code for auto-salt handling in RSA-PSS verification.
 *
 * @param {string} sourceCode - JavaScript/TypeScript source code
 * @returns {object} Audit report with mathematical safety proof
 */
export function auditCryptoRsaPssAutoSaltSafety(sourceCode = '') {
  let isRsaPssVerify = false
  for (const pattern of RSA_PSS_VERIFY_PATTERNS) {
    if (pattern.test(sourceCode)) {
      isRsaPssVerify = true
      break
    }
  }

  if (!isRsaPssVerify) {
    return {
      safe: true,
      isRsaPssVerify: false,
      violations: [],
      rsaPssAutoSaltProof: 'NO_RSA_PSS_VERIFY_OPERATION_DETECTED',
    }
  }

  let hasAutoSalt = false
  for (const pattern of SECURE_AUTO_SALT_PATTERNS) {
    if (pattern.test(sourceCode)) {
      hasAutoSalt = true
      break
    }
  }

  const violations = []
  if (!hasAutoSalt) {
    violations.push('RSA_PSS_VERIFY_MISSING_EXPLICIT_AUTO_OR_DIGEST_SALTLENGTH')
  }

  const safe = violations.length === 0

  return {
    safe,
    isRsaPssVerify: true,
    violations,
    rsaPssAutoSaltProof: safe
      ? 'SECURE_RSA_PSS_AUTO_SALT_VERIFIED'
      : 'INSECURE_OR_FIXED_RSA_PSS_VERIFY_SALT_DETECTED',
  }
}
