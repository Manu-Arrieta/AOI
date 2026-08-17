/**
 * scripts/aoi-os/storage-guard/browser-storage-quota-guard.mjs
 *
 * Deterministic Browser Storage Quota & Expiration Guard for AOI-OS:
 * Statically audits localStorage, sessionStorage, and IndexedDB write operations to verify
 * that QuotaExceededError handling or data size/expiration guards are present (0 LLM Tokens).
 */

/**
 * Audits source code for safe browser storage operations.
 *
 * @param {string} sourceCode - Frontend store or composable source code
 * @returns {object} Storage quota audit report
 */
export function auditBrowserStorageQuotaSafety(sourceCode = '') {
  const violations = []

  const hasStorageWrites = /\b(?:localStorage\.setItem|sessionStorage\.setItem|indexedDB\.open)\s*\(/g.test(sourceCode)
  const hasQuotaGuard = /\b(?:try\s*\{|catch\s*\(|QuotaExceeded|expiresIn|maxSize|quota)\b/g.test(sourceCode)

  if (hasStorageWrites && !hasQuotaGuard) {
    violations.push({
      type: 'UNGUARDED_BROWSER_STORAGE_WRITE',
      recommendation: "Wrap 'localStorage.setItem()' in a try-catch block to gracefully handle QuotaExceededError, or enforce storage size limits.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasStorageWrites,
    violationsCount: violations.length,
    violations,
    storageProof: safe ? 'BROWSER_STORAGE_QUOTA_SAFE' : 'UNGUARDED_STORAGE_WRITE_DETECTED',
  }
}
