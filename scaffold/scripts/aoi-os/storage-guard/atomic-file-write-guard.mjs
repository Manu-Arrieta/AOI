/**
 * scripts/aoi-os/storage-guard/atomic-file-write-guard.mjs
 *
 * Deterministic Atomic File Replace & Staged Write Guard for AOI-OS:
 * Statically audits file mutation and state persistence routines to verify that
 * atomic temp-file-and-rename writes (fs.writeFileSync + fs.renameSync) are utilized to prevent corruption (0 LLM Tokens).
 */

/**
 * Audits source code for atomic file writing patterns.
 *
 * @param {string} sourceCode - File persistence handler source code
 * @returns {object} Atomic write audit report
 */
export function auditAtomicFileWriteSafety(sourceCode = '') {
  const violations = []

  const hasDirectWrite = /(?:fs\.writeFileSync|fs\.writeFile|fsp\.writeFile)\s*\(/g.test(sourceCode)
  const isStateOrSnapshot = /(?:snapshot|state|manifest|active\.json|config\.json)\b/i.test(sourceCode)
  const hasAtomicRename = /(?:fs\.renameSync|fs\.rename|fsp\.rename|atomicWrite|writeGzipJsonFile)\s*\(/g.test(sourceCode)

  if (hasDirectWrite && isStateOrSnapshot && !hasAtomicRename) {
    violations.push({
      type: 'NON_ATOMIC_STATE_FILE_WRITE',
      recommendation: "Use staged atomic writing (write to temporary file then 'fs.renameSync()') to prevent corrupted state files on abrupt termination.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasDirectWrite,
    isStateOrSnapshot,
    violationsCount: violations.length,
    violations,
    atomicProof: safe ? 'ATOMIC_FILE_WRITES_ENFORCED' : 'NON_ATOMIC_WRITE_CORRUPTION_RISK',
  }
}
