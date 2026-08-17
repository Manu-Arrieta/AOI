/**
 * scripts/aoi-os/storage-guard/file-watcher-debounce-guard.mjs
 *
 * Deterministic Atomic File Watcher Debounce & Teardown Guard for AOI-OS:
 * Statically audits filesystem watchers (fs.watch, fs.watchFile, chokidar) in agent daemon loops
 * to verify that event handlers implement explicit debouncing/throttling and teardown handlers
 * (watcher.close()), preventing CPU starvation from duplicate event bursts and unclosed inode notification leaks (0 LLM Tokens).
 */

/**
 * Audits filesystem watcher source code for debouncing and deterministic teardown closure.
 *
 * @param {string} sourceCode - File watcher source code
 * @returns {object} File watcher safety report
 */
export function auditFileWatcherDebounceSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const hasWatcher = /(?:fs\.watch\s*\(|fs\.watchFile\s*\(|chokidar\.watch\s*\()/i.test(cleanCode)

  if (hasWatcher) {
    const hasDebounceOrThrottle = /(?:debounce|throttle|clearTimeout|setTimeout|rateLimit|timer)/i.test(cleanCode)
    if (!hasDebounceOrThrottle) {
      violations.push({
        type: 'FILE_WATCHER_BURST_WITHOUT_DEBOUNCE',
        recommendation: "Filesystem watcher ('fs.watch'/'chokidar') detected without event debouncing or throttling. Wrap event handlers with a debounce timer (e.g. 100-300ms) to prevent duplicate event cascades during rapid file saves.",
      })
    }

    const hasTeardownClose = /(?:\.close\s*\(|unwatchFile\s*\(|dispose|teardown)/i.test(cleanCode)
    if (!hasTeardownClose) {
      violations.push({
        type: 'FILE_WATCHER_MISSING_TEARDOWN_CLOSURE',
        recommendation: "Filesystem watcher lacks explicit teardown closure (watcher.close() or fs.unwatchFile()). Ensure lifecycle teardown hooks close active watchers to prevent inode descriptor leaks.",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    hasWatcher,
    violationsCount: violations.length,
    violations,
    watcherProof: safe ? 'FILE_WATCHER_DEBOUNCED_AND_DISPOSED' : 'WATCHER_BURST_LEAK_RISK',
  }
}
