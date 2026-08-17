/**
 * scripts/aoi-os/storage-guard/file-watcher-recursive-guard.mjs
 *
 * Deterministic Atomic File Watcher Recursive Depth Guard for AOI-OS:
 * Statically audits recursive filesystem watchers (fs.watch(dir, { recursive: true }))
 * to verify cross-platform compatibility (recursive option is unsupported on Linux by native inotify
 * unless paired with directory tree traversal or robust libraries like chokidar), preventing silent
 * monitoring failures across OS deployments (0 LLM Tokens).
 */

/**
 * Audits filesystem watcher source code for cross-platform recursive depth safety.
 *
 * @param {string} sourceCode - File watcher source code
 * @returns {object} Recursive watcher safety report
 */
export function auditFileWatcherRecursiveSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const hasNativeFsWatch = /fs\.watch\s*\(/i.test(cleanCode)
  const hasRecursiveOption = /recursive\s*:\s*true/i.test(cleanCode)

  if (hasNativeFsWatch && hasRecursiveOption) {
    const hasPlatformCheckOrChokidar = /(?:process\.platform|platform\s*!==?\s*['"`]linux['"`]|chokidar|recursiveWatch|walkDir|traverseTree)/i.test(cleanCode)

    if (!hasPlatformCheckOrChokidar) {
      violations.push({
        type: 'UNGUARDED_NATIVE_FS_WATCH_RECURSIVE_FLAG',
        recommendation: "Native 'fs.watch(..., { recursive: true })' detected without Linux fallback/check. The 'recursive: true' flag is unsupported on Linux (inotify limitation). Use 'chokidar' or implement explicit subdirectory crawler tracking for cross-platform compatibility.",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    hasNativeFsWatch,
    hasRecursiveOption,
    violationsCount: violations.length,
    violations,
    watcherRecursiveProof: safe ? 'FILE_WATCHER_RECURSIVE_PLATFORM_COMPLIANT' : 'NATIVE_RECURSIVE_WATCHER_LINUX_UNSUPPORTED',
  }
}
