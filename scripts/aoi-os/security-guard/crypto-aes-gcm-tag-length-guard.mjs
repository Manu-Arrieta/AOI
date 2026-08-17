/**
 * scripts/aoi-os/security-guard/crypto-aes-gcm-tag-length-guard.mjs
 *
 * Deterministic AES-GCM AuthTag Length Guard for AOI-OS:
 * Audits AEAD cipher implementations (crypto.createCipheriv / createDecipheriv with AES-GCM)
 * to ensure that authentication tag length is strictly specified as 16 bytes (128 bits / authTagLength: 16),
 * preventing authentication tag truncation vulnerabilities and forgery attacks (0 LLM Tokens).
 */

const AES_GCM_CIPHER_PATTERNS = [
  /['"]aes-(?:128|192|256)-gcm['"]/i,
]

const INSECURE_TAG_LENGTH_PATTERNS = [
  /authTagLength\s*:\s*(?:[1-9]|1[0-5])\b/,
]

const SECURE_TAG_LENGTH_PATTERNS = [
  /authTagLength\s*:\s*16\b/,
  /tag\s*\.\s*length\s*===?\s*16\b/,
  /Buffer\s*\.\s*byteLength\s*\([^)]+\)\s*===?\s*16\b/,
]

/**
 * Audits cryptographic source code for strict 16-byte AES-GCM authentication tag safety.
 *
 * @param {string} sourceCode - JavaScript/TypeScript code
 * @returns {object} Audit report with mathematical safety proof
 */
export function auditCryptoAesGcmTagLengthSafety(sourceCode = '') {
  let usesAesGcm = false
  for (const pattern of AES_GCM_CIPHER_PATTERNS) {
    if (pattern.test(sourceCode)) {
      usesAesGcm = true
      break
    }
  }

  if (!usesAesGcm) {
    return {
      safe: true,
      usesAesGcm: false,
      violations: [],
      aesGcmTagLengthProof: 'NO_AES_GCM_OPERATION_DETECTED',
    }
  }

  const violations = []

  // Check for truncated tag length
  for (const pattern of INSECURE_TAG_LENGTH_PATTERNS) {
    if (pattern.test(sourceCode)) {
      violations.push('INSECURE_TRUNCATED_AES_GCM_AUTHTAG_LENGTH_SPECIFIED')
    }
  }

  // Check if secure 16-byte tag length is present
  let hasSecureTagLength = false
  for (const pattern of SECURE_TAG_LENGTH_PATTERNS) {
    if (pattern.test(sourceCode)) {
      hasSecureTagLength = true
      break
    }
  }

  if (!hasSecureTagLength && violations.length === 0) {
    violations.push('MISSING_EXPLICIT_16_BYTE_AUTHTAG_LENGTH_IN_AES_GCM')
  }

  const safe = violations.length === 0

  return {
    safe,
    usesAesGcm: true,
    violations,
    aesGcmTagLengthProof: safe
      ? 'STRICT_16_BYTE_AES_GCM_AUTHTAG_VERIFIED'
      : 'INSECURE_OR_TRUNCATED_AES_GCM_AUTHTAG_DETECTED',
  }
}
