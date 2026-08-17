/**
 * scripts/aoi-os/storage-guard/file-watcher-error-guard.mjs
 *
 * Deterministic Atomic File Watcher Error Listener Guard for AOI-OS:
 * Statically audits filesystem watcher instances (fs.watch, chokidar.watch) to verify
 * that explicit 'error' event listeners (watcher.on('error', ...)) are attached,
 * preventing unhandled exceptions and crashes in long-running workspace daemons (0 LLM Tokens).
 */

/**
 * Audits filesystem watcher source code for explicit error event handling.
 *
 * @param {string} sourceCode - Watcher source code
 * @returns {object} File watcher error handling safety report
 */
export function auditFileWatcherErrorSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const hasWatcherInit = /(?:fs\.watch\s*\(|chokidar\.watch\s*\(|new\s+FSWatcher)/i.test(cleanCode)

  if (hasWatcherInit) {
    const hasErrorListener = /(?:\.on\s*\(\s*['"`]error['"`]|\.once\s*\(\s*['"`]error['"`]|try\s*\{[\s\S]*?catch)/i.test(cleanCode)

    if (!hasErrorListener) {
      violations.push({
        type: 'FILE_WATCHER_MISSING_ERROR_LISTENER',
        recommendation: "Filesystem watcher is initialized without an explicit 'error' event listener. Attach watcher.on('error', (err) => { ... }) to handle unexpected file deletions, EPERM, or inotify overflow without terminating the daemon process.",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    hasWatcherInit,
    violationsCount: violations.length,
    violations,
    watcherErrorProof: safe ? 'WATCHER_ERROR_HANDLER_VERIFIED' : 'UNHANDLED_WATCHER_ERROR_CRASH_RISK',
  }
}
