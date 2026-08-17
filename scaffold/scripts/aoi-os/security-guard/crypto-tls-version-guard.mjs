/**
 * scripts/aoi-os/security-guard/crypto-tls-version-guard.mjs
 *
 * Deterministic Safe Cryptographic TLS Minimum Protocol Version Guard for AOI-OS:
 * Statically audits TLS socket and HTTPS server/agent options (https.createServer, tls.connect, minVersion, secureProtocol)
 * to verify that minimum TLS version is explicitly enforced to TLSv1.2 or TLSv1.3 and forbids legacy insecure
 * protocols (SSLv3, TLSv1.0, TLSv1.1) (0 LLM Tokens).
 */

const INSECURE_TLS_VERSIONS = [
  /['"](?:SSLv3|TLSv1|TLSv1\.0|TLSv1\.1)['"]/i,
]

/**
 * Audits TLS/HTTPS configuration source code for secure minVersion enforcement.
 *
 * @param {string} sourceCode - TLS configuration source code
 * @returns {object} TLS version audit report
 */
export function auditCryptoTlsVersionSafety(sourceCode = '') {
  const violations = []

  const createsTlsContext = /(?:https\.createServer|tls\.createServer|tls\.connect|new\s+https\.Agent|tls\.createSecureContext)\s*\(/g.test(sourceCode)
  const specifiesInsecureVersion = INSECURE_TLS_VERSIONS.some((pattern) => pattern.test(sourceCode))
  const enforcesSecureMinVersion = /(?:minVersion\s*:\s*['"]TLSv1\.[23]['"]|secureProtocol\s*:\s*['"]TLSv1_[23]_method['"])/i.test(sourceCode)

  if (specifiesInsecureVersion) {
    violations.push({
      type: 'INSECURE_LEGACY_TLS_PROTOCOL',
      recommendation: "Avoid legacy SSLv3, TLSv1.0, and TLSv1.1. Set 'minVersion: \"TLSv1.2\"' or 'minVersion: \"TLSv1.3\"' explicitly.",
    })
  } else if (createsTlsContext && !enforcesSecureMinVersion) {
    violations.push({
      type: 'UNSPECIFIED_MIN_TLS_VERSION',
      recommendation: "Explicitly declare 'minVersion: \"TLSv1.2\"' or 'minVersion: \"TLSv1.3\"' in TLS options to prevent protocol downgrade attacks.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    createsTlsContext,
    violationsCount: violations.length,
    violations,
    tlsProof: safe ? 'MODERN_TLS_MIN_VERSION_ENFORCED' : 'INSECURE_TLS_PROTOCOL_DOWNGRADE_RISK',
  }
}
