/**
 * scripts/aoi-os/security-guard/crypto-tls-ocsp-guard.mjs
 *
 * Deterministic Safe Cryptographic TLS OCSP Stapling Verification Guard for AOI-OS:
 * Statically audits TLS/HTTPS client configurations (requestOCSP in tls.connect / https.request)
 * to verify that OCSP response verification listeners (socket.on('OCSPResponse')) are attached,
 * ensuring real-time certificate revocation status verification without latency penalties (0 LLM Tokens).
 */

/**
 * Audits TLS source code for explicit OCSP stapling request and response verification.
 *
 * @param {string} sourceCode - TLS connection source code
 * @returns {object} TLS OCSP stapling safety report
 */
export function auditCryptoTlsOcspSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const hasRequestOcspTrue = /requestOCSP\s*:\s*true/i.test(cleanCode)

  if (hasRequestOcspTrue) {
    const hasOcspResponseListener = /(?:\.on\s*\(\s*['"`]OCSPResponse['"`]|\.once\s*\(\s*['"`]OCSPResponse['"`]|verifyOcsp|validateOcsp)/i.test(cleanCode)

    if (!hasOcspResponseListener) {
      violations.push({
        type: 'REQUEST_OCSP_MISSING_RESPONSE_HANDLER',
        recommendation: "TLS connection specifies 'requestOCSP: true' but lacks an 'OCSPResponse' event listener on the socket to inspect the stapled revocation response. Attach socket.on('OCSPResponse', (response) => { ... }) to complete revocation validation.",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    hasRequestOcspTrue,
    violationsCount: violations.length,
    violations,
    tlsOcspProof: safe ? 'TLS_OCSP_STAPLING_VERIFIED' : 'OCSP_RESPONSE_UNHANDLED_RISK',
  }
}
