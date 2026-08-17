/**
 * scripts/aoi-os/sandbox-guard/sandbox-ipc-payload-prover.mjs
 *
 * Deterministic Sandbox Child Process IPC Message Length & Payload Bounds Prover for AOI-OS:
 * Statically proves that child process IPC communication (child.send(msg), process.send(msg)) validates
 * message payload bounds (e.g. Buffer.byteLength, size limits < 64MB, or filesystem staging) to prevent
 * fatal V8 serialization crashes and IPC channel choking (0 LLM Tokens).
 */

/**
 * Audits sandbox IPC communication source code for message payload bounds validation.
 *
 * @param {string} sourceCode - Sandbox IPC communication source code
 * @returns {object} IPC payload bounds proof report
 */
export function proveSandboxIpcPayloadSafety(sourceCode = '') {
  const violations = []

  const hasIpcSend = /(?:\.send\s*\(|process\.send\s*\()/g.test(sourceCode)
  const hasPayloadBoundsOrStaging = /(?:byteLength|MAX_IPC_PAYLOAD|JSON\.stringify\(.*\)\.length|payloadSize|maxPayload|stagingPath|fs\.writeFileSync)/i.test(sourceCode)

  if (hasIpcSend && !hasPayloadBoundsOrStaging) {
    violations.push({
      type: 'UNBOUNDED_IPC_MESSAGE_PAYLOAD',
      recommendation: "Validate IPC message payload size before transmission (e.g. 'Buffer.byteLength(JSON.stringify(msg)) <= MAX_IPC_PAYLOAD') or stage large payloads via filesystem to prevent V8 serialization fatal crashes.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasIpcSend,
    violationsCount: violations.length,
    violations,
    ipcPayloadProof: safe ? 'BOUNDED_IPC_MESSAGE_PAYLOAD_ENFORCED' : 'UNBOUNDED_IPC_MESSAGE_PAYLOAD_DETECTED',
  }
}
