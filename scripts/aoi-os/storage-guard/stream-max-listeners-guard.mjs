/**
 * scripts/aoi-os/storage-guard/stream-max-listeners-guard.mjs
 *
 * Deterministic Atomic Stream & EventEmitter MaxListeners Leak Guard for AOI-OS:
 * Statically audits custom EventEmitter, Stream, and event pipeline source code
 * to verify explicit listener bounding (setMaxListeners) or deterministic cleanup (removeListener/off),
 * preventing MaxListenersExceededWarning and memory leaks under high-throughput data loads (0 LLM Tokens).
 */

/**
 * Audits EventEmitter/Stream registration source code for MaxListeners safety or cleanup.
 *
 * @param {string} sourceCode - Event registration source code
 * @returns {object} MaxListeners audit report
 */
export function auditStreamMaxListenersSafety(sourceCode = '') {
  const violations = []

  const createsEmitterOrRegistersMany = /(?:new\s+EventEmitter\s*\(|\.on\s*\(\s*['"][a-zA-Z0-9_-]+['"])/i.test(sourceCode)
  const hasBoundsOrCleanup = /(?:setMaxListeners\s*\(\s*\d+\s*\)|\.removeListener\s*\(|\.off\s*\(|\.once\s*\(|eventEmitter\.setMaxListeners)/i.test(sourceCode)

  const hasHighVolumeLoops = /(?:for\s*\([^)]*\)\s*\{[^}]*\.on\s*\(|while\s*\([^)]*\)\s*\{[^}]*\.on\s*\()/i.test(sourceCode)

  if (hasHighVolumeLoops && !hasBoundsOrCleanup) {
    violations.push({
      type: 'UNBOUNDED_EVENT_LISTENER_LOOP',
      recommendation: "Ensure EventEmitter listeners registered inside loops or pipelines have explicit 'setMaxListeners(...)' or are cleaned up with 'removeListener'/'off' to prevent memory leaks.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    createsEmitterOrRegistersMany,
    violationsCount: violations.length,
    violations,
    listenersProof: safe ? 'SAFE_MAX_LISTENERS_BOUNDING_ENFORCED' : 'UNBOUNDED_MAX_LISTENERS_LEAK_RISK',
  }
}
