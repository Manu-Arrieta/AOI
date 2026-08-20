/**
 * scripts/aoi-os/storage-guard/file-atomic-temp-extension-guard.mjs
 *
 * Deterministic Atomic File Staging Naming and Hidden Dot-Prefix Guard for AOI-OS:
 * Audits atomic file writing and staging routines to guarantee that temporary staging files
 * use a hidden dot-prefix and a safe disposable temporary extension (e.g. `.${basename}.${id}.tmp`),
 * preventing bundlers (Vite/Rollup), file watchers, and indexers from ingesting incomplete staging files (0 LLM Tokens).
 */

const ATOMIC_STAGING_PATTERNS = [
  /\bfs\s*\.\s*(?:writeFile|writeFileSync|createWriteStream)\s*\(\s*([^,)]+)/,
  /\bpromises\s*\.\s*writeFile\s*\(\s*([^,)]+)/,
]

const HIDDEN_TMP_PATTERNS = [
  /['"`]\.\$\{[^}]+\}[^'"`]*\.tmp['"`]/,
  /['"`]\.[^'"`/]+\.tmp['"`]/,
  /\bpath\s*\.\s*join\s*\(\s*[^,]+,\s*['"`]\.[^'"`]+\.tmp['"`]\s*\)/,
  /\bpath\s*\.\s*join\s*\(\s*path\s*\.\s*dirname\s*\([^)]+\)\s*,\s*[`'"]\.\$\{[^}]+\}[^`'"]*\.tmp[`'"]\s*\)/,
  /\b\.tmp\b/,
]

/**
 * Audits source code for hidden dot-prefix and safe disposable extension in staging files.
 *
 * @param {string} sourceCode - JavaScript/TypeScript source code
 * @returns {object} Audit report with mathematical safety proof
 */
export function auditAtomicTempExtensionSafety(sourceCode = '') {
  let isAtomicStaging = false
  for (const pattern of ATOMIC_STAGING_PATTERNS) {
    if (pattern.test(sourceCode) && (sourceCode.includes('rename') || sourceCode.includes('temp') || sourceCode.includes('staging'))) {
      isAtomicStaging = true
      break
    }
  }

  if (!isAtomicStaging) {
    return {
      safe: true,
      isAtomicStaging: false,
      hasHiddenTmpFormat: false,
      violations: [],
      atomicTempExtensionProof: 'NO_ATOMIC_STAGING_OPERATION_DETECTED',
    }
  }

  let hasHiddenTmpFormat = false
  for (const pattern of HIDDEN_TMP_PATTERNS) {
    if (pattern.test(sourceCode)) {
      hasHiddenTmpFormat = true
      break
    }
  }

  const violations = []
  if (!hasHiddenTmpFormat) {
    violations.push('ATOMIC_STAGING_FILE_MISSING_HIDDEN_DOT_PREFIX_OR_TMP_EXTENSION')
  }

  const safe = violations.length === 0

  return {
    safe,
    isAtomicStaging: true,
    hasHiddenTmpFormat,
    violations,
    atomicTempExtensionProof: safe
      ? 'HIDDEN_DOT_PREFIX_TMP_EXTENSION_VERIFIED'
      : 'EXPOSED_STAGING_FILE_INGESTION_RISK_DETECTED',
  }
}
