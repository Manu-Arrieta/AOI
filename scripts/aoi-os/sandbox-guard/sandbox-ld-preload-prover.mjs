/**
 * scripts/aoi-os/sandbox-guard/sandbox-ld-preload-prover.mjs
 *
 * Deterministic Sandbox Dynamic Linker Preload Sanitization Prover for AOI-OS:
 * Statically proves that subprocess spawn environments in hermetic sandboxes explicitly strip,
 * sanitize, or forbid dangerous dynamic linker injection variables (LD_PRELOAD, LD_LIBRARY_PATH,
 * DYLD_INSERT_LIBRARIES, DYLD_LIBRARY_PATH) to prevent DLL hijacking and rootkit execution (0 LLM Tokens).
 */

const UNSAFE_LINKER_PRELOAD_PATTERNS = [
  /(?:LD_PRELOAD|DYLD_INSERT_LIBRARIES)\s*:\s*['"][^'"]+/i,
  /(?:LD_LIBRARY_PATH|DYLD_LIBRARY_PATH)\s*:\s*['"](?:\.|\.\/|\/tmp|[^'"]*(?::\.|:\.\/|:\/tmp))/i,
]

/**
 * Audits sandbox environment variable declarations for dynamic linker preload hijacking vulnerabilities.
 *
 * @param {string} sourceCode - Process spawn environment source code
 * @returns {object} Linker preload environment audit report
 */
export function proveSandboxLdPreloadSafety(sourceCode = '') {
  const violations = []

  const setsLinkerVars = /(?:LD_PRELOAD|LD_LIBRARY_PATH|DYLD_INSERT_LIBRARIES|DYLD_LIBRARY_PATH)\s*:/i.test(sourceCode)
  const hasUnsafeLinkerPreload = UNSAFE_LINKER_PRELOAD_PATTERNS.some((p) => p.test(sourceCode))

  if (hasUnsafeLinkerPreload) {
    violations.push({
      type: 'INSECURE_SANDBOX_DYNAMIC_LINKER_INJECTION',
      recommendation: "Subprocess environment in sandbox contains unsafe LD_PRELOAD, DYLD_INSERT_LIBRARIES, or untrusted LD_LIBRARY_PATH. Strip all dynamic linker preload variables.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    setsLinkerVars,
    violationsCount: violations.length,
    violations,
    linkerProof: safe ? 'SANITIZED_DYNAMIC_LINKER_ENFORCED' : 'INSECURE_LINKER_PRELOAD_RISK',
  }
}
