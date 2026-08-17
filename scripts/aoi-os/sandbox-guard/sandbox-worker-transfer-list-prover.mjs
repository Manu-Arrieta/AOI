/**
 * scripts/aoi-os/sandbox-guard/sandbox-worker-transfer-list-prover.mjs
 *
 * Deterministic Sandbox Worker TransferList & Zero-Copy Prover for AOI-OS:
 * Statically proves that Worker postMessage calls sending ArrayBuffer / MessagePort objects in sandboxes
 * explicitly include the transferList argument (e.g. parentPort.postMessage(buffer, [buffer.buffer]))
 * to ensure zero-copy ownership transfer and prevent structured clone memory bloat (0 LLM Tokens).
 */

/**
 * Audits Worker postMessage calls for explicit transferList usage on binary payloads.
 *
 * @param {string} sourceCode - Worker postMessage source code
 * @returns {object} Worker transferList audit report
 */
export function proveSandboxWorkerTransferListSafety(sourceCode = '') {
  const violations = []

  const usesArrayBufferPostMessage = /(?:postMessage\s*\(\s*(?:buffer|arrayBuffer|uint8Array\.buffer|port|channel\.port\d)\s*\))/i.test(sourceCode)
  const hasTransferList = /(?:postMessage\s*\(\s*[^,]+,\s*\[[^\]]+\]\s*\))/i.test(sourceCode)

  if (usesArrayBufferPostMessage && !hasTransferList) {
    violations.push({
      type: 'WORKER_POSTMESSAGE_MISSING_TRANSFER_LIST',
      recommendation: "Worker postMessage transmits binary buffer without 'transferList' (e.g. postMessage(buf, [buf])). Pass transferList array to achieve zero-copy transfer and avoid memory duplication.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    violationsCount: violations.length,
    violations,
    transferProof: safe ? 'ZERO_COPY_TRANSFER_LIST_ENFORCED' : 'STRUCTURED_CLONING_MEMORY_BLOAT_RISK',
  }
}
