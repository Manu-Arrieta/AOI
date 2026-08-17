/**
 * scripts/aoi-os/security-guard/crypto-x509-cert-guard.mjs
 *
 * Deterministic Safe Cryptographic X.509 Certificate Guard for AOI-OS:
 * Statically audits crypto.X509Certificate instantiation and handling code to verify that
 * certificate validation routines explicitly invoke checkHost(), checkIssued(), or validity checks
 * (validTo/validFrom) before trusting client/peer certificates, preventing MITM vulnerabilities (0 LLM Tokens).
 */

/**
 * Audits X.509 certificate handling source code for explicit host/issuer/validity verification.
 *
 * @param {string} sourceCode - Cryptographic source code
 * @returns {object} X.509 certificate validation safety report
 */
export function auditCryptoX509CertSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const usesX509 = /(?:new\s+crypto\.X509Certificate|new\s+X509Certificate|X509Certificate\s*\()/i.test(cleanCode)

  if (usesX509) {
    const hasValidation = /(?:\.checkHost\s*\(|\.checkIssued\s*\(|\.checkPrivateKey\s*\(|\.validTo|\.validFrom)/i.test(cleanCode)
    if (!hasValidation) {
      violations.push({
        type: 'X509_CERTIFICATE_MISSING_EXPLICIT_VALIDATION',
        recommendation: "X509Certificate instantiated but lacks explicit validation calls (.checkHost(), .checkIssued(), or .validTo date comparison). Verify certificate chain and host identity before establishing trust.",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    usesX509,
    violationsCount: violations.length,
    violations,
    x509Proof: safe ? 'X509_CERTIFICATE_VALIDATED' : 'UNVERIFIED_X509_CERTIFICATE_RISK',
  }
}
