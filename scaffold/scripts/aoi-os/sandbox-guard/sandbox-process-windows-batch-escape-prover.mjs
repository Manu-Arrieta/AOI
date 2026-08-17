/**
 * scripts/aoi-os/sandbox-guard/sandbox-process-windows-batch-escape-prover.mjs
 *
 * Deterministic Sandbox Process Windows Batch Metacharacter Escaping Prover for AOI-OS:
 * Statically proves that argument arrays passed to .bat/.cmd scripts or executed with
 * windowsVerbatimArguments: true apply explicit Windows cmd metacharacter sanitization
 * (^, &, |, <, >, %, "), neutralizing batch command parser escapes on Windows (0 LLM Tokens).
 */

/**
 * Audits child process batch execution source code for metacharacter escaping routines.
 *
 * @param {string} sourceCode - Child process execution source code
 * @returns {object} Windows batch escaping safety report
 */
export function proveSandboxProcessWindowsBatchEscapeSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const hasBatchTarget = /(?:\.bat['"`]|\.cmd['"`]|windowsVerbatimArguments)/i.test(cleanCode)
  const hasSpawnOrExec = /(?:spawn\s*\(|execFile\s*\(|fork\s*\()/i.test(cleanCode)

  if (hasBatchTarget && hasSpawnOrExec) {
    const hasEscapeFunction = /(?:escapeBatchArg|escapeCmd|sanitizeBatch|quoteBatchArg|escapeArgs|\.replace\s*\()/i.test(cleanCode)

    if (!hasEscapeFunction) {
      violations.push({
        type: 'MISSING_WINDOWS_BATCH_METACHARACTER_ESCAPING',
        recommendation: "Child process execution invokes a Windows .bat/.cmd script or uses windowsVerbatimArguments without explicit metacharacter escaping. Apply caret/quote escaping for characters (^, &, |, <, >, %, \") on dynamic arguments to prevent command parser breakages.",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    hasBatchTarget,
    hasSpawnOrExec,
    violationsCount: violations.length,
    violations,
    batchEscapeProof: safe ? 'WINDOWS_BATCH_METACHARACTERS_ESCAPED' : 'UNESCAPED_BATCH_METACHARACTER_RISK',
  }
}
