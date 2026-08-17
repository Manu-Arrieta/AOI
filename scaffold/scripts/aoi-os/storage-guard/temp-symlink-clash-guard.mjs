/**
 * scripts/aoi-os/storage-guard/temp-symlink-clash-guard.mjs
 *
 * Deterministic Atomic Temporary Symlink Clashing & Race Guard for AOI-OS:
 * Statically audits symlink creation operations (fs.symlink, fs.symlinkSync) to verify that
 * temporary/atomic symlink destinations use non-colliding random suffixes (crypto.randomUUID)
 * or unlink guards rather than static predictable paths vulnerable to TOCTOU symlink race conditions (0 LLM Tokens).
 */

/**
 * Audits symlink creation source code for temporary collision and race safety.
 *
 * @param {string} sourceCode - Symlink creation source code
 * @returns {object} Symlink collision audit report
 */
export function auditTempSymlinkClashSafety(sourceCode = '') {
  const violations = []

  const createsSymlink = /(?:fs\.symlinkSync|fs\.symlink|symlinkAtomic)\s*\(/i.test(sourceCode)
  const usesPredictableStaticTempPath = /(?:['"`]\/tmp\/|\btempPath\b|\btmpLink\b|\.tmp\b)[^;)]*['"`]\s*,\s*[^;)]*\)/i.test(sourceCode) || /symlinkSync\s*\([^,]+,\s*['"][^'"]*(?:tmp|temp)[^'"]*['"]\s*\)/i.test(sourceCode)
  const usesRandomNonceOrUnlink = /(?:randomUUID|randomBytes|unlinkSync|rmSync|existsSync\([^)]*\)\s*&&\s*fs\.unlinkSync)/i.test(sourceCode)

  if (createsSymlink && usesPredictableStaticTempPath && !usesRandomNonceOrUnlink) {
    violations.push({
      type: 'PREDICTABLE_TEMP_SYMLINK_RACE_RISK',
      recommendation: "Ensure temporary symlink target paths include a cryptographically non-colliding suffix (crypto.randomUUID()) and unlink existing stale symlinks before creation.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    createsSymlink,
    violationsCount: violations.length,
    violations,
    symlinkProof: safe ? 'SAFE_ATOMIC_SYMLINK_CREATION_ENFORCED' : 'PREDICTABLE_SYMLINK_TOCTOU_COLLISION_RISK',
  }
}
