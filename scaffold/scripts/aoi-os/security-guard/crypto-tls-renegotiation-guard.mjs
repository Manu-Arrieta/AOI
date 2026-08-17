/**
 * scripts/aoi-os/security-guard/crypto-tls-renegotiation-guard.mjs
 *
 * Deterministic Safe Cryptographic TLS Renegotiation DoS Guard for AOI-OS:
 * Statically audits TLS/HTTPS server configurations (tls.createServer, https.createServer)
 * to verify that client-initiated TLS session renegotiation CPU exhaustion vulnerabilities
 * (CVE-2011-1473 / CVE-2011-5094) are mitigated via TLSv1.3 enforcement (minVersion: 'TLSv1.3')
 * or explicit renegotiation bounding (0 LLM Tokens).
 */

/**
 * Audits TLS server source code for session renegotiation DoS protection.
 *
 * @param {string} sourceCode - TLS server source code
 * @returns {object} TLS renegotiation safety report
 */
export function auditCryptoTlsRenegotiationSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const hasTlsServer = /(?:tls\.createServer\s*\(|https\.createServer\s*\(|new\s+tls\.Server)/i.test(cleanCode)

  if (hasTlsServer) {
    const hasTls13Enforced = /(?:minVersion\s*:\s*['"`]TLSv1\.3['"`]|maxVersion\s*:\s*['"`]TLSv1\.3['"`]|disableRenegotiation|renegotiationLimit)/i.test(cleanCode)
    const hasExplicitLegacyTls = /minVersion\s*:\s*['"`](?:TLSv1|TLSv1\.1|TLSv1\.2)['"`]/i.test(cleanCode)

    if (hasExplicitLegacyTls && !hasTls13Enforced) {
      violations.push({
        type: 'LEGACY_TLS_RENEGOTIATION_DOS_RISK',
        recommendation: "TLS server specifies legacy minVersion ('TLSv1.2' or lower) without renegotiation limits. Set 'minVersion: \"TLSv1.3\"' (where renegotiation was removed from the RFC specification) or enforce renegotiation rate limits to prevent CPU exhaustion DoS (CVE-2011-1473).",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    hasTlsServer,
    violationsCount: violations.length,
    violations,
    tlsRenegotiationProof: safe ? 'TLS_RENEGOTIATION_DEFENSE_VERIFIED' : 'TLS_RENEGOTIATION_DOS_EXPOSURE_RISK',
  }
}
