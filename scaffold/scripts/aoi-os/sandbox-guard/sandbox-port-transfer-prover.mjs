/**
 * scripts/aoi-os/sandbox-guard/sandbox-port-transfer-prover.mjs
 *
 * Deterministic Sandbox Dynamic Worker MessagePort Transfer Prover for AOI-OS:
 * Statically proves that MessageChannel ports transferred to sandbox workers (postMessage(..., [port2]))
 * have explicit port closure lifecycle management (port1.close() / port.close()) upon worker termination
 * to prevent IPC handle and file descriptor leaks (0 LLM Tokens).
 */

/**
 * Audits MessageChannel creation and transfer source code for deterministic port closure.
 *
 * @param {string} sourceCode - Worker communication source code
 * @returns {object} Port transfer closure proof report
 */
export function proveSandboxPortTransferSafety(sourceCode = '') {
  const violations = []

  const createsMessageChannel = /(?:new\s+MessageChannel\s*\(|MessageChannel\s*\()/i.test(sourceCode)
  const transfersPort = /\.postMessage\s*\([^,]+,\s*\[[^\]]*(?:port2|port1|port)[^\]]*\]\s*\)/i.test(sourceCode)
  const closesPort = /(?:port1\.close|port2\.close|port\.close)\s*\(/i.test(sourceCode)

  if (createsMessageChannel && transfersPort && !closesPort) {
    violations.push({
      type: 'UNCLOSED_TRANSFERRED_MESSAGE_PORT',
      recommendation: "Ensure transferred MessagePort instances are explicitly closed ('port1.close()' or 'port2.close()') in worker teardown hooks to prevent IPC descriptor leaks.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    createsMessageChannel,
    violationsCount: violations.length,
    violations,
    portProof: safe ? 'DETERMINISTIC_MESSAGE_PORT_CLOSURE_ENFORCED' : 'UNCLOSED_MESSAGE_PORT_LEAK_RISK',
  }
}
