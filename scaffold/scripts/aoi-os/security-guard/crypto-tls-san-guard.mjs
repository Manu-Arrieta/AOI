/**
 * scripts/aoi-os/security-guard/crypto-tls-san-guard.mjs
 *
 * Deterministic Safe Cryptographic TLS SAN Guard for AOI-OS:
 * Statically audits TLS certificate verification and secure context routines (tls.connect,
 * crypto.createSecureContext, checkServerIdentity) to ensure host validation adheres to
 * Subject Alternative Names (SAN / subjectAltName / checkHost) per RFC 6125 / RFC 9525,
 * flagging legacy insecure fallback to deprecated Common Name (CN) matching (0 LLM Tokens).
 */

/**
 * Audits TLS host validation source code for Subject Alternative Names (SAN) compliance.
 *
 * @param {string} sourceCode - TLS verification source code
 * @returns {object} TLS SAN verification safety report
 */
export function auditCryptoTlsSanSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const hasCustomCheckServerIdentity = /checkServerIdentity\s*:/i.test(cleanCode)

  if (hasCustomCheckServerIdentity) {
    const usesSanOrCheckHost = /(?:subjectAltName|\.checkHost|cert\.subjectaltname|altnames)/i.test(cleanCode)
    const usesLegacyCnOnly = /(?:cert\.subject\.CN|subject\.CN|\.CN\b)/i.test(cleanCode) && !usesSanOrCheckHost

    if (usesLegacyCnOnly) {
      violations.push({
        type: 'DEPRECATED_TLS_COMMON_NAME_VALIDATION',
        recommendation: "Custom checkServerIdentity validates only 'CN' (Common Name). Modern TLS (RFC 6125 / RFC 9525) deprecates CN in favor of 'subjectAltName' (SAN) or native 'tls.checkServerIdentity' / 'cert.checkHost()'.",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    hasCustomCheckServerIdentity,
    violationsCount: violations.length,
    violations,
    tlsSanProof: safe ? 'TLS_SAN_RFC6125_VERIFIED' : 'DEPRECATED_CN_MATCHING_RISK',
  }
}
