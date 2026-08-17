/**
 * scripts/aoi-os/security-guard/crypto-rsa-pss-salt-length-guard.mjs
 *
 * Deterministic RSA-PSS Salt Length Security Guard for AOI-OS:
 * Audits cryptographic RSA-PSS sign and verify operations to ensure that saltLength
 * is explicitly specified with standard cryptographic constants (RSA_PSS_SALTLEN_DIGEST / RSA_PSS_SALTLEN_MAX_SIGN)
 * or secure bounded integer values (>= 16 bytes), preventing salt truncation and signature forgery (0 LLM Tokens).
 */

const RSA_PSS_PADDING_PATTERNS = [
  /\bRSA_PKCS1_PSS_PADDING\b/,
  /padding\s*:\s*(?:crypto\s*\.\s*constants\s*\.\s*)?RSA_PKCS1_PSS_PADDING\b/,
]

const SECURE_SALT_LENGTH_PATTERNS = [
  /saltLength\s*:\s*(?:crypto\s*\.\s*constants\s*\.\s*)?RSA_PSS_SALTLEN_DIGEST\b/,
  /saltLength\s*:\s*(?:crypto\s*\.\s*constants\s*\.\s*)?RSA_PSS_SALTLEN_MAX_SIGN\b/,
  /saltLength\s*:\s*(?:1[6-9]|[2-5][0-9]|64)\b/,
]

const INSECURE_SALT_LENGTH_PATTERNS = [
  /saltLength\s*:\s*(?:[0-9]|1[0-5])\b/,
  /saltLength\s*:\s*-[0-9]+\b/,
]

/**
 * Audits cryptographic source code for strict and secure RSA-PSS salt length specifications.
 *
 * @param {string} sourceCode - JavaScript/TypeScript source code
 * @returns {object} Audit report with mathematical safety proof
 */
export function auditCryptoRsaPssSaltLengthSafety(sourceCode = '') {
  let usesRsaPss = false
  for (const pattern of RSA_PSS_PADDING_PATTERNS) {
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
      rsaPssSaltLengthProof: 'NO_RSA_PSS_OPERATION_DETECTED',
    }
  }

  const violations = []

  for (const pattern of INSECURE_SALT_LENGTH_PATTERNS) {
    if (pattern.test(sourceCode)) {
      violations.push('INSECURE_SHORT_OR_INVALID_RSA_PSS_SALTLENGTH')
    }
  }

  let hasSecureSaltLength = false
  for (const pattern of SECURE_SALT_LENGTH_PATTERNS) {
    if (pattern.test(sourceCode)) {
      hasSecureSaltLength = true
      break
    }
  }

  if (!hasSecureSaltLength && violations.length === 0) {
    violations.push('MISSING_EXPLICIT_SECURE_RSA_PSS_SALTLENGTH_CONSTANT')
  }

  const safe = violations.length === 0

  return {
    safe,
    usesRsaPss: true,
    violations,
    rsaPssSaltLengthProof: safe
      ? 'SECURE_RSA_PSS_SALTLENGTH_VERIFIED'
      : 'INSECURE_OR_MISSING_RSA_PSS_SALTLENGTH_DETECTED',
  }
}
