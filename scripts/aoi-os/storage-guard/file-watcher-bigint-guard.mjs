/**
 * scripts/aoi-os/storage-guard/file-watcher-bigint-guard.mjs
 *
 * Deterministic Atomic File Watcher BigInt Stat Precision Guard for AOI-OS:
 * Statically audits filesystem polling and timestamp comparison routines (fs.watchFile,
 * fs.stat, fs.statSync) in agent loops to verify that high-frequency timestamp comparisons
 * use BigInt precision (bigint: true / mtimeNs) instead of floating-point mtimeMs,
 * preventing missed file change detections during rapid successive atomic writes (0 LLM Tokens).
 */

/**
 * Audits filesystem stat and polling source code for BigInt timestamp precision safety.
 *
 * @param {string} sourceCode - File stat/polling source code
 * @returns {object} BigInt stat precision safety report
 */
export function auditFileWatcherBigIntSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const hasWatchFileOrStatPolling = /(?:fs\.watchFile\s*\(|fs\.stat\s*\(|fs\.statSync\s*\(|fs\.promises\.stat\s*\()/i.test(cleanCode)
  const hasTimestampComparison = /(?:mtime|mtimeMs|mtimeNs|ctime|birthtime)/i.test(cleanCode)

  if (hasWatchFileOrStatPolling && hasTimestampComparison) {
    const hasBigIntOptionOrNs = /(?:bigint\s*:\s*true|mtimeNs|ctimeNs|birthtimeNs|BigInt\s*\()/i.test(cleanCode)

    if (!hasBigIntOptionOrNs) {
      violations.push({
        type: 'FLOAT_STAT_TIMESTAMP_PRECISION_LOSS',
        recommendation: "Filesystem stat/polling comparison uses standard floating-point millisecond timestamps (mtimeMs). Pass '{ bigint: true }' to fs.stat() and compare 'mtimeNs' as BigInt to avoid missed change events on rapid successive writes.",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    hasWatchFileOrStatPolling,
    hasTimestampComparison,
    violationsCount: violations.length,
    violations,
    watcherBigIntProof: safe ? 'STAT_TIMESTAMP_BIGINT_PRECISION_ENFORCED' : 'FLOAT_TIMESTAMP_PRECISION_LOSS_RISK',
  }
}
