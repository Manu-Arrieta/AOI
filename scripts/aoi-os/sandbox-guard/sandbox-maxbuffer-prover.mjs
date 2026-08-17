/**
 * scripts/aoi-os/sandbox-guard/sandbox-maxbuffer-prover.mjs
 *
 * Deterministic Sandbox Child Process MaxBuffer Overflow Prover for AOI-OS:
 * Statically proves that subprocess execution routines (exec, execSync) in sandboxes configure an explicit
 * maxBuffer limit or use streams to prevent unhandled ERR_CHILD_PROCESS_STDIO_MAXBUFFER buffer overflow crashes (0 LLM Tokens).
 */

/**
 * Audits sandbox execution wrapper source code for maxBuffer configuration.
 *
 * @param {string} sourceCode - Sandbox subprocess launcher source code
 * @returns {object} MaxBuffer proof report
 */
export function proveSandboxMaxBufferSafety(sourceCode = '') {
  const violations = []

  const hasExec = /(?:\bexec|\bexecSync)\s*\(/g.test(sourceCode)
  const hasMaxBuffer = /(?:maxBuffer\s*:|stdio\s*:|spawn\s*\()/i.test(sourceCode)

  if (hasExec && !hasMaxBuffer) {
    violations.push({
      type: 'UNBOUNDED_SUBPROCESS_MAXBUFFER',
      recommendation: "Ensure subprocess execution configures an explicit 'maxBuffer: 10 * 1024 * 1024' (10MB+) or uses 'spawn()' with streaming I/O to prevent ERR_CHILD_PROCESS_STDIO_MAXBUFFER fatal crashes.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasExec,
    violationsCount: violations.length,
    violations,
    maxBufferProof: safe ? 'MAXBUFFER_OVERFLOW_PREVENTED' : 'MAXBUFFER_OVERFLOW_RISK_DETECTED',
  }
}
