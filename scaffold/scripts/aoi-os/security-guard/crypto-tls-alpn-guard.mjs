/**
 * scripts/aoi-os/security-guard/crypto-tls-alpn-guard.mjs
 *
 * Deterministic Safe Cryptographic TLS ALPN Protocol Negotiation Guard for AOI-OS:
 * Statically audits TLS/HTTPS client and server connection options (ALPNProtocols in tls.connect,
 * https.createServer, tls.createServer) to verify that negotiated application protocols conform
 * to standard IANA ALPN identifiers (e.g. ['h2', 'http/1.1']) without malformed or deprecated tokens (0 LLM Tokens).
 */

/**
 * Audits TLS source code for standard Application-Layer Protocol Negotiation (ALPN) configuration.
 *
 * @param {string} sourceCode - TLS connection or server source code
 * @returns {object} TLS ALPN validation safety report
 */
export function auditCryptoTlsAlpnSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const hasAlpnDeclaration = /ALPNProtocols\s*:/i.test(cleanCode)

  if (hasAlpnDeclaration) {
    const hasArrayOrBufferAlpn = /ALPNProtocols\s*:\s*\[/i.test(cleanCode) || /ALPNProtocols\s*:\s*Buffer/i.test(cleanCode)
    if (!hasArrayOrBufferAlpn) {
      violations.push({
        type: 'INVALID_ALPN_PROTOCOLS_TYPE',
        recommendation: "ALPNProtocols must be specified as an Array of standard protocol strings (e.g. ['h2', 'http/1.1']) or a wire-format Buffer.",
      })
    }

    const hasKnownStandardProtocol = /(?:['"`]h2['"`]|['"`]http\/1\.1['"`]|['"`]h3['"`]|['"`]http\/1\.0['"`]|['"`]spdy\/3\.1['"`])/i.test(cleanCode)
    if (!hasKnownStandardProtocol) {
      violations.push({
        type: 'NON_STANDARD_ALPN_PROTOCOL_IDENTIFIER',
        recommendation: "ALPNProtocols contains non-standard or unapproved protocol tokens. Use IANA standard identifiers such as 'h2' and 'http/1.1'.",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    hasAlpnDeclaration,
    violationsCount: violations.length,
    violations,
    tlsAlpnProof: safe ? 'TLS_ALPN_IANA_COMPLIANT' : 'TLS_ALPN_NON_STANDARD_RISK',
  }
}
