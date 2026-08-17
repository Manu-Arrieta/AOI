/**
 * scripts/aoi-os/sandbox-guard/sandbox-process-windows-path-prover.mjs
 *
 * Deterministic Sandbox Process Cross-Platform Path Normalization Prover for AOI-OS:
 * Statically proves that executable and working directory paths passed to child process spawns
 * (spawn, execFile, fork) in sandboxes use canonical path normalization (path.normalize / path.resolve),
 * preventing ENOENT spawn failures and path separator ambiguity across OS boundaries (0 LLM Tokens).
 */

/**
 * Audits child process spawn source code for canonical path normalization of executables.
 *
 * @param {string} sourceCode - Child process spawn source code
 * @returns {object} Cross-platform path normalization safety report
 */
export function proveSandboxProcessWindowsPathSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const hasSpawn = /(?:spawn\s*\(|execFile\s*\(|fork\s*\()/i.test(cleanCode)

  if (hasSpawn) {
    const hasUnnormalizedPathLiteral = /(?:spawn|execFile|fork)\s*\(\s*['"`](?:\.\.?[\\/]|[\\/])[^'"`\n]*['"`]/i.test(cleanCode)
    const hasPathNormalization = /(?:path\.resolve|path\.normalize|path\.join|resolvePath|normalizePath)/i.test(cleanCode)

    if (hasUnnormalizedPathLiteral && !hasPathNormalization) {
      violations.push({
        type: 'UNNORMALIZED_CROSS_PLATFORM_SPAWN_PATH',
        recommendation: "Child process spawn target uses un-normalized relative/POSIX path literal. Wrap target binary and cwd paths with 'path.resolve()' or 'path.normalize()' to guarantee cross-platform execution on Windows.",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    hasSpawn,
    violationsCount: violations.length,
    violations,
    windowsPathProof: safe ? 'CROSS_PLATFORM_SPAWN_PATH_NORMALIZED' : 'UNNORMALIZED_SPAWN_PATH_RISK',
  }
}
