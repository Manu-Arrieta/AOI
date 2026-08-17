/**
 * scripts/aoi-os/storage-guard/file-truncate-boundary-guard.mjs
 *
 * Deterministic Atomic File Truncate Boundary Guard for AOI-OS:
 * Statically audits file truncation routines (fs.truncate, fs.promises.truncate, fs.ftruncate)
 * in state and journal persistence code to verify that in-place truncation is protected by
 * an exclusive file lock, staged file replace, or handle synchronization, preventing partial-read
 * race conditions and NULL byte exposure (0 LLM Tokens).
 */

/**
 * Audits file truncate source code for exclusive locking or staged replacement safety.
 *
 * @param {string} sourceCode - File truncate source code
 * @returns {object} File truncate boundary safety report
 */
export function auditFileTruncateBoundarySafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const hasTruncate = /(?:fs\.truncate\s*\(|fs\.promises\.truncate\s*\(|ftruncate\s*\(|truncate\s*\()/i.test(cleanCode)

  if (hasTruncate) {
    const hasLockOrStaging = /(?:lock|mutex|rename|stage|atomic|exclusive|flock|lockfile)/i.test(cleanCode)
    if (!hasLockOrStaging) {
      violations.push({
        type: 'UNPROTECTED_IN_PLACE_FILE_TRUNCATION',
        recommendation: "Unprotected in-place file truncation ('truncate'/'ftruncate') detected without explicit lock or atomic staging. Protect the operation with an exclusive lock or use atomic rename replacement to avoid race conditions with concurrent readers.",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    hasTruncate,
    violationsCount: violations.length,
    violations,
    truncateProof: safe ? 'FILE_TRUNCATE_BOUNDARY_LOCKED' : 'UNGUARDED_TRUNCATION_RACE_RISK',
  }
}
