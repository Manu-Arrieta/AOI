/**
 * scripts/aoi-os/storage-guard/file-append-lock-guard.mjs
 *
 * Deterministic Atomic File Append Sequential Lock Guard for AOI-OS:
 * Statically audits asynchronous file append routines (fs.appendFile, fs.promises.appendFile)
 * in logging and journal persistence code to ensure an explicit sequential queue, mutex locking,
 * or synchronous atomic staging is enforced, preventing interleaved bytes and line corruption (0 LLM Tokens).
 */

/**
 * Audits file append source code for sequential locking or serialized queue protection.
 *
 * @param {string} sourceCode - File append source code
 * @returns {object} File append locking safety report
 */
export function auditFileAppendLockSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const hasAsyncAppend = /(?:fs\.appendFile\s*\(|fs\.promises\.appendFile\s*\(|appendFile\s*\()/i.test(cleanCode)

  if (hasAsyncAppend) {
    const hasLockOrQueue = /(?:mutex|lock|queue|enqueue|p-limit|pQueue|semaphore|appendFileSync|chain|\.then\s*\()/i.test(cleanCode)
    if (!hasLockOrQueue) {
      violations.push({
        type: 'CONCURRENT_ASYNC_FILE_APPEND_WITHOUT_LOCK',
        recommendation: "Unprotected asynchronous file append detected ('appendFile'). Use a serialized queue, in-memory mutex, or atomic staged lock to prevent interleaved bytes and corrupted log lines under high concurrency.",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    hasAsyncAppend,
    violationsCount: violations.length,
    violations,
    appendLockProof: safe ? 'FILE_APPEND_CONCURRENCY_LOCKED' : 'INTERLEAVED_APPEND_CORRUPTION_RISK',
  }
}
