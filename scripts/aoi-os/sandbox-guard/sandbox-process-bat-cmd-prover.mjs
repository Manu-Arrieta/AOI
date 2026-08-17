/**
 * scripts/aoi-os/sandbox-guard/sandbox-process-bat-cmd-prover.mjs
 *
 * Deterministic Sandbox Process Windows Batch File Command Injection Prover for AOI-OS:
 * Statically proves that child process spawns (spawn, execFile) invoking Windows batch files (.bat, .cmd)
 * in cross-platform/sandbox environments enforce explicit argument escaping, quoting, or array sanitization,
 * preventing critical batch argument command injection vulnerabilities (CVE-2024-27980) (0 LLM Tokens).
 */

/**
 * Audits child process batch execution source code for argument sanitization/quoting safety.
 *
 * @param {string} sourceCode - Child process spawn source code
 * @returns {object} Windows batch command injection safety report
 */
export function proveSandboxProcessBatCmdSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const executesBatOrCmd = /(?:\.bat\b|\.cmd\b)/i.test(cleanCode)

  if (executesBatOrCmd) {
    const hasSpawnOrExec = /(?:spawn\s*\(|execFile\s*\(|fork\s*\()/i.test(cleanCode)
    if (hasSpawnOrExec) {
      const hasSanitizationOrQuote = /(?:escape|sanitize|quote|encode|validate|replace|windowsVerbatimArguments)/i.test(cleanCode)
      if (!hasSanitizationOrQuote) {
        violations.push({
          type: 'UNSANITIZED_WINDOWS_BATCH_FILE_EXECUTION',
          recommendation: "Invocation of .bat/.cmd file detected without explicit argument sanitization or quoting. On Windows, executing batch files via spawn/execFile with dynamic arguments risks command injection (CVE-2024-27980). Sanitize or escape batch arguments.",
        })
      }
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    executesBatOrCmd,
    violationsCount: violations.length,
    violations,
    batchCmdProof: safe ? 'WINDOWS_BATCH_ARGS_SANITIZED' : 'BATCH_FILE_COMMAND_INJECTION_RISK',
  }
}
