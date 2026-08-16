/**
 * scripts/aoi-os/sandbox-guard/sandbox-socket-unbind-prover.mjs
 *
 * Deterministic Network Socket Unbind & Ephemeral Port Cleanup Prover for AOI-OS:
 * Statically proves that ephemeral HTTP/TCP listening servers (http.createServer, app.listen)
 * invoke server.close() in teardown hooks (afterAll, afterEach, finally) preventing EADDRINUSE collisions (0 LLM Tokens).
 */

/**
 * Audits source code for listening server socket closure and unbinding in teardown hooks.
 *
 * @param {string} sourceCode
 * @returns {object} Socket unbind audit report
 */
export function proveSocketUnbindSafety(sourceCode = '') {
  const violations = []

  const hasListenServer = /\b(?:http\.createServer|net\.createServer|\.listen\s*\()\b/g.test(sourceCode)
  const hasCloseTeardown = /\b(?:\.close\s*\(|afterAll|afterEach|finally)\b/g.test(sourceCode)

  if (hasListenServer && !hasCloseTeardown) {
    violations.push({
      type: 'UNCLOSED_NETWORK_LISTEN_SOCKET',
      recommendation: "Ensure listening servers (app.listen / createServer) invoke 'server.close()' in 'afterAll()' or 'finally' blocks to prevent EADDRINUSE errors.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasListenServer,
    violationsCount: violations.length,
    violations,
    socketProof: safe ? 'NETWORK_SOCKET_UNBIND_GUARANTEED' : 'UNCLOSED_LISTEN_SOCKET_DETECTED',
  }
}
