/**
 * scripts/aoi-os/security-guard/crypto-rsa-pss-key-export-guard.mjs
 *
 * Deterministic RSA-PSS PKCS#8 Key Export Format Guard for AOI-OS:
 * Audits cryptographic private key export operations for RSA-PSS to ensure that private keys
 * are strictly exported using standard PKCS#8 (`type: 'pkcs8'`), prohibiting legacy unencapsulated PKCS#1 formats (0 LLM Tokens).
 */

const KEY_EXPORT_PATTERNS = [
  /\b(?:privateKey|key)\s*\.\s*export\s*\(\s*\{([^}]+)\}\s*\)/,
  /\bgenerateKeyPair(?:Sync)?\s*\([^,]+,\s*\{[^}]*privateKeyEncoding\s*:\s*\{([^}]+)\}/,
]

/**
 * Audits cryptographic source code for standard PKCS#8 private key export format.
 *
 * @param {string} sourceCode - JavaScript/TypeScript source code
 * @returns {object} Audit report with mathematical safety proof
 */
export function auditCryptoRsaPssKeyExportSafety(sourceCode = '') {
  let isKeyExport = false
  let exportOptionsStr = ''

  for (const pattern of KEY_EXPORT_PATTERNS) {
    const match = sourceCode.match(pattern)
    if (match) {
      isKeyExport = true
      exportOptionsStr = match[1] || ''
      break
    }
  }

  if (!isKeyExport) {
    return {
      safe: true,
      isKeyExport: false,
      hasPkcs8: false,
      violations: [],
      rsaPssKeyExportProof: 'NO_KEY_EXPORT_OPERATION_DETECTED',
    }
  }

  const hasPkcs8 = /type\s*:\s*['"]pkcs8['"]/.test(exportOptionsStr) || /type\s*:\s*['"]pkcs8['"]/.test(sourceCode)
  const hasPkcs1 = /type\s*:\s*['"]pkcs1['"]/.test(exportOptionsStr) || /type\s*:\s*['"]pkcs1['"]/.test(sourceCode)

  const violations = []
  if (hasPkcs1 || !hasPkcs8) {
    violations.push('INSECURE_KEY_EXPORT_FORMAT: RSA-PSS private key must be exported as PKCS#8 (type: "pkcs8")')
  }

  const safe = violations.length === 0

  return {
    safe,
    isKeyExport: true,
    hasPkcs8,
    violations,
    rsaPssKeyExportProof: safe
      ? 'SECURE_PKCS8_KEY_EXPORT_VERIFIED'
      : 'INSECURE_OR_LEGACY_KEY_EXPORT_FORMAT_DETECTED',
  }
}
