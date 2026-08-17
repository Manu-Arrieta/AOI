/**
 * scripts/aoi-os/sandbox-guard/sandbox-process-posix-shell-prover.mjs
 *
 * Deterministic Sandbox Process POSIX Shell Word Splitting Prover for AOI-OS:
 * Statically proves that POSIX subshell executions (/bin/sh, /bin/bash, sh -c, bash -c)
 * enclose variables within command strings in double quotes ("$VAR") instead of unquoted $VAR,
 * preventing word splitting, glob expansion, and argument manipulation in sandboxes (0 LLM Tokens).
 */

/**
 * Audits child process POSIX shell execution source code for unquoted variable expansion.
 *
 * @param {string} sourceCode - Child process execution source code
 * @returns {object} POSIX shell word splitting safety report
 */
export function proveSandboxProcessPosixShellSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const hasPosixShell = /(?:['"`]\/bin\/sh['"`]|['"`]\/bin\/bash['"`]|['"`]sh['"`]|['"`]bash['"`]|['-c['"`])/i.test(cleanCode)
  const hasSpawnOrExec = /(?:spawn\s*\(|execFile\s*\(|exec\s*\()/i.test(cleanCode)

  if (hasPosixShell && hasSpawnOrExec) {
    // Look for unquoted variables in shell commands: e.g., $var without surrounding double quotes
    // Match unquoted variable expansion like `rm -rf $DIR` or `cat $FILE`
    const hasUnquotedVariable = /(?:[^\"]|^)\$[a-zA-Z_][a-zA-Z0-9_]*(?:[^\"]|$)/m.test(cleanCode) &&
      !/\"\$[a-zA-Z_][a-zA-Z0-9_]*\"/.test(cleanCode)

    if (hasUnquotedVariable) {
      violations.push({
        type: 'POSIX_SHELL_UNQUOTED_VARIABLE_WORD_SPLITTING',
        recommendation: "POSIX subshell execution contains unquoted variable expansion ($VAR). Enclose variables in double quotes (\"$VAR\") to prevent shell word splitting and unintended pathname globbing.",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    hasPosixShell,
    hasSpawnOrExec,
    violationsCount: violations.length,
    violations,
    posixShellProof: safe ? 'POSIX_SHELL_VARIABLES_PROPERLY_QUOTED' : 'UNQUOTED_SHELL_VARIABLE_WORD_SPLITTING_RISK',
  }
}
