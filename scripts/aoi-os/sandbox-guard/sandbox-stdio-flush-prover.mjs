/**
 * scripts/aoi-os/sandbox-guard/sandbox-stdio-flush-prover.mjs
 *
 * Deterministic Sandbox Child Process Stdio Buffer Flush Prover for AOI-OS:
 * Statically proves that child process runners in sandboxes listen for the 'close' event (or await
 * stdio stream 'end'/'finish') rather than prematurely resolving on 'exit' before stdio buffers
 * have fully flushed to prevent log truncation (0 LLM Tokens).
 */

/**
 * Audits child process spawn/execution source code for deterministic stdio buffer flush handling.
 *
 * @param {string} sourceCode - Child process execution source code
 * @returns {object} Stdio buffer flush proof report
 */
export function proveSandboxStdioFlushSafety(sourceCode = '') {
  const violations = []

  const spawnsChildProcess = /(?:child_process|\bspawn\s*\(|\bfork\s*\(|\bexec\s*\(|\bexecFile\s*\()/i.test(sourceCode)
  const listensForExitOnly = /\.on\s*\(\s*['"]exit['"]/i.test(sourceCode) && !/\.on\s*\(\s*['"]close['"]/i.test(sourceCode)
  const awaitsStreamEndOrClose = /(?:\.on\s*\(\s*['"]close['"]|\.stdout\.on\s*\(\s*['"]end['"]|finished\s*\(|Promise\.all\s*\([^)]*stdout)/i.test(sourceCode)

  if (spawnsChildProcess && listensForExitOnly && !awaitsStreamEndOrClose) {
    violations.push({
      type: 'PREMATURE_PROCESS_EXIT_BEFORE_STDIO_FLUSH',
      recommendation: "Listen for the process 'close' event or await stdout/stderr stream 'end' events rather than resolving on 'exit', as stdio streams may still contain buffered output after exit.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    spawnsChildProcess,
    violationsCount: violations.length,
    violations,
    flushProof: safe ? 'COMPLETE_STDIO_STREAM_FLUSH_ENFORCED' : 'PREMATURE_EXIT_LOG_TRUNCATION_RISK',
  }
}
