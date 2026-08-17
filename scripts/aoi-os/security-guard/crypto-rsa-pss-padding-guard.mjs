/**
 * scripts/aoi-os/security-guard/crypto-rsa-pss-padding-guard.mjs
 *
 * Deterministic Safe Cryptographic RSA-PSS Padding & Salt Guard for AOI-OS:
 * Statically audits crypto.sign and crypto.verify calls using RSA_PKCS1_PSS_PADDING to verify that
 * saltLength is explicitly specified (e.g. crypto.constants.RSA_PSS_SALTLEN_DIGEST), preventing
 * RSA-PSS signature malleability and weak salt interoperability vulnerabilities (RFC 8017) (0 LLM Tokens).
 */

/**
 * Audits RSA-PSS signature and verification source code for explicit saltLength specification.
 *
 * @param {string} sourceCode - Cryptographic source code
 * @returns {object} RSA-PSS padding and salt safety audit report
 */
export function auditCryptoRsaPssPaddingSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const usesPssPadding = /(?:RSA_PKCS1_PSS_PADDING|padding\s*:\s*crypto\.constants\.RSA_PKCS1_PSS_PADDING)/i.test(cleanCode)
  const hasExplicitSaltLength = /saltLength\s*:/i.test(cleanCode)

  if (usesPssPadding && !hasExplicitSaltLength) {
    violations.push({
      type: 'RSA_PSS_MISSING_SALTLENGTH',
      recommendation: "crypto.sign/verify uses 'RSA_PKCS1_PSS_PADDING' without explicit 'saltLength'. Specify saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST to enforce canonical deterministic verification.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    usesPssPadding,
    violationsCount: violations.length,
    violations,
    rsaPssProof: safe ? 'RSA_PSS_PADDING_CANONICAL' : 'UNSPECIFIED_RSA_PSS_SALTLEN_RISK',
  }
}
