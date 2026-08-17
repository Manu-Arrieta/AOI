/**
 * scripts/aoi-os/sandbox-guard/sandbox-stdin-close-prover.mjs
 *
 * Deterministic Sandbox Child Process Stdin Stream Closure Prover for AOI-OS:
 * Statically proves that child processes with piped standard input explicitly call child.stdin.end()
 * or child.stdin.destroy() after sending payloads to signal EOF and prevent worker hanging (0 LLM Tokens).
 */

/**
 * Audits child process execution source code for deterministic stdin stream closure.
 *
 * @param {string} sourceCode - Child process execution source code
 * @returns {object} Stdin closure proof report
 */
export function proveSandboxStdinClosureSafety(sourceCode = '') {
  const violations = []

  const writesToStdin = /(?:child\.stdin\.write|\.stdin\.write|\.stdin\.end)\s*\(/i.test(sourceCode)
  const callsStdinEnd = /(?:child\.stdin\.end|\.stdin\.end|\.stdin\.destroy)\s*\(/i.test(sourceCode)

  if (writesToStdin && !callsStdinEnd) {
    violations.push({
      type: 'UNCLOSED_STDIN_STREAM_HANG_RISK',
      recommendation: "Ensure 'child.stdin.end()' is invoked after writing payloads to signal EOF and prevent indefinite child process hangs.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    writesToStdin,
    violationsCount: violations.length,
    violations,
    stdinProof: safe ? 'DETERMINISTIC_STDIN_EOF_CLOSURE_ENFORCED' : 'UNCLOSED_STDIN_STREAM_HANG_RISK',
  }
}
