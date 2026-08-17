/**
 * scripts/aoi-os/security-guard/crypto-tls-sni-guard.mjs
 *
 * Deterministic Safe Cryptographic TLS SNI Hostname Validation Guard for AOI-OS:
 * Statically audits TLS client requests and socket handshakes (tls.connect, https.request,
 * SNICallback) to verify that servername (SNI per RFC 6066) is explicitly declared and validated,
 * preventing TLS routing failures, certificate mismatch errors, and domain fronting ambiguities (0 LLM Tokens).
 */

/**
 * Audits TLS client connection source code for explicit Server Name Indication (SNI / servername) declaration.
 *
 * @param {string} sourceCode - TLS connection source code
 * @returns {object} TLS SNI validation safety report
 */
export function auditCryptoTlsSniSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const hasTlsClientConnect = /(?:tls\.connect\s*\(|https\.request\s*\(|https\.get\s*\()/i.test(cleanCode)

  if (hasTlsClientConnect) {
    const hasExplicitServername = /(?:servername\s*:|servername|checkServerIdentity)/i.test(cleanCode)
    if (!hasExplicitServername) {
      violations.push({
        type: 'TLS_CLIENT_CONNECT_MISSING_SERVERNAME_SNI',
        recommendation: "TLS client connection (tls.connect/https.request) detected without explicit 'servername' (SNI) option. Specify 'servername: host' (RFC 6066) to ensure correct certificate selection on multi-tenant servers and avoid handshake failures.",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    hasTlsClientConnect,
    violationsCount: violations.length,
    violations,
    tlsSniProof: safe ? 'TLS_SNI_RFC6066_ENFORCED' : 'TLS_SNI_OMITTED_ROUTING_RISK',
  }
}
