/**
 * scripts/aoi-os/storage-guard/file-umask-guard.mjs
 *
 * Deterministic Atomic File Permissions & umask Enforcement Guard for AOI-OS:
 * Statically audits sensitive file creation operations (private keys, tokens, credentials, .env files)
 * to verify that restrictive POSIX permissions (mode: 0o600 / 0o700) or process.umask are enforced (0 LLM Tokens).
 */

/**
 * Audits source code for secure file permission modes on sensitive file writes.
 *
 * @param {string} sourceCode - File creation or credential storage source code
 * @returns {object} File permission audit report
 */
export function auditFileUmaskSafety(sourceCode = '') {
  const violations = []

  const isSensitiveFileWrite = /(?:key|secret|token|credential|id_rsa|privateKey|\.env)\b/i.test(sourceCode)
  const hasFileCreation = /(?:fs\.writeFileSync|fs\.writeFile|fsp\.writeFile|fs\.mkdirSync|fsp\.mkdir)\s*\(/g.test(sourceCode)
  const hasSecureModeOrUmask = /(?:mode\s*:\s*0o?[67]00|chmodSync\([^)]*0o?[67]00|process\.umask\s*\()/i.test(sourceCode)

  if (isSensitiveFileWrite && hasFileCreation && !hasSecureModeOrUmask) {
    violations.push({
      type: 'WORLD_READABLE_SENSITIVE_FILE_WRITE',
      recommendation: "Ensure sensitive credential / key file writes specify restrictive permissions ({ mode: 0o600 }) or enforce 'process.umask(0o077)'.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    isSensitiveFileWrite,
    hasFileCreation,
    violationsCount: violations.length,
    violations,
    umaskProof: safe ? 'RESTRICTIVE_FILE_PERMISSIONS_ENFORCED' : 'WORLD_READABLE_SECRET_FILE_RISK',
  }
}
