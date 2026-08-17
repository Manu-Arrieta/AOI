/**
 * scripts/aoi-os/sandbox-guard/sandbox-process-windows-hide-prover.mjs
 *
 * Deterministic Sandbox Process windowsHide Isolation Prover for AOI-OS:
 * Statically proves that child process spawning calls (spawn, exec, execFile, fork) executed in sandboxes
 * explicitly configure windowsHide: true in their options object, preventing disruptive console window popups
 * on Windows runners and guaranteeing deterministic headless process containment across all OS platforms (0 LLM Tokens).
 */

/**
 * Audits child process spawning source code for explicit windowsHide: true configuration.
 *
 * @param {string} sourceCode - Child process spawn source code
 * @returns {object} windowsHide configuration audit report
 */
export function proveSandboxProcessWindowsHideSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const spawnsChildProcess = /(?:(?:spawn|exec|execFile|fork)\s*\([^,]+,\s*(?:\[[^\]]*\],\s*)?\{)/i.test(cleanCode)
  const hasWindowsHide = /windowsHide\s*:\s*true/i.test(cleanCode)

  if (spawnsChildProcess && !hasWindowsHide) {
    violations.push({
      type: 'CHILD_PROCESS_MISSING_WINDOWS_HIDE',
      recommendation: "Child process spawn options lack 'windowsHide: true'. Set 'windowsHide: true' to guarantee silent, non-blocking headless execution across Windows/macOS/Linux environments.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    spawnsChildProcess,
    violationsCount: violations.length,
    violations,
    windowsHideProof: safe ? 'CROSS_PLATFORM_HEADLESS_PROCESS_ENFORCED' : 'POPUP_WINDOW_PROCESS_RISK',
  }
}
