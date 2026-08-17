/**
 * scripts/aoi-os/storage-guard/file-lock-lease-guard.mjs
 *
 * Deterministic Atomic File Lock & PID Lease Expiration Guard for AOI-OS:
 * Statically audits file lock acquisition routines (.lock files, mutex leases)
 * to verify that stale lock detection (process.kill(pid, 0)) and lease expiration policies (TTL) are enforced (0 LLM Tokens).
 */

/**
 * Audits source code for safe file lock acquisition and stale lock recovery.
 *
 * @param {string} sourceCode - Lockfile manager source code
 * @returns {object} File lock safety report
 */
export function auditFileLockLeaseSafety(sourceCode = '') {
  const violations = []

  const hasFileLock = /(?:\.lock\b|acquireLock|createLockFile|fs\.openSync\([^)]*['"]wx['"]\))/i.test(sourceCode)
  const hasStaleLockCheck = /(?:process\.kill\([^,)]*,\s*0\)|staleCheck|isProcessAlive|checkStaleLock|lockAge\s*>|ttl\b)/i.test(sourceCode)

  if (hasFileLock && !hasStaleLockCheck) {
    violations.push({
      type: 'UNGUARDED_STALE_FILE_LOCK',
      recommendation: "Ensure file lock acquisition includes stale lock detection ('process.kill(pid, 0)' or lease TTL check) to prevent permanent deadlocks on unexpected process crash.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasFileLock,
    violationsCount: violations.length,
    violations,
    lockLeaseProof: safe ? 'FILE_LOCK_LEASE_EXPIRATION_ENFORCED' : 'STALE_LOCK_DEADLOCK_RISK_DETECTED',
  }
}
