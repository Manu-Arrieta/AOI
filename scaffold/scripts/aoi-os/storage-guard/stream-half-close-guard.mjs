/**
 * scripts/aoi-os/storage-guard/stream-half-close-guard.mjs
 *
 * Deterministic Atomic Stream Duplex & Half-Close Socket Guard for AOI-OS:
 * Statically audits sockets and Duplex streams (net.Socket, tls.TLSSocket, stream.Duplex) configured
 * with allowHalfOpen: true to ensure an explicit .destroy() call or 'end'/'close' event listener exists,
 * preventing orphaned half-open TCP connections in CLOSE_WAIT state and OS descriptor leaks (0 LLM Tokens).
 */

/**
 * Audits socket and Duplex stream source code for proper full-close and destruction handling.
 *
 * @param {string} sourceCode - Socket/Duplex stream source code
 * @returns {object} Half-close socket audit report
 */
export function auditStreamHalfCloseSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const hasAllowHalfOpen = /allowHalfOpen\s*:\s*true/i.test(cleanCode)

  if (hasAllowHalfOpen) {
    const hasTeardown = /(?:\.destroy\s*\(|\.on\s*\(\s*['"](?:end|close)['"]|\.once\s*\(\s*['"](?:end|close)['"])/i.test(cleanCode)
    if (!hasTeardown) {
      violations.push({
        type: 'HALF_OPEN_SOCKET_MISSING_TEARDOWN',
        recommendation: "Socket/Duplex stream configured with 'allowHalfOpen: true' but lacks an explicit .destroy() or 'end'/'close' event listener. Ensure full connection teardown to prevent CLOSE_WAIT descriptor leaks.",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    hasAllowHalfOpen,
    violationsCount: violations.length,
    violations,
    halfCloseProof: safe ? 'HALF_OPEN_SOCKET_TEARDOWN_ENFORCED' : 'ORPHANED_CLOSE_WAIT_SOCKET_RISK',
  }
}
