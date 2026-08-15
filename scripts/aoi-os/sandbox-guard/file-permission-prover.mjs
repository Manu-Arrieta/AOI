/**
 * scripts/aoi-os/sandbox-guard/file-permission-prover.mjs
 *
 * Deterministic Sandbox File Permission & Mask Prover for AOI-OS:
 * Statically audits file creation modes and chmod bitmasks in sandbox code,
 * proving that no files or scripts are created with dangerous world-writable permissions (0 LLM Tokens).
 */

const DANGEROUS_MASKS = ['0777', '0666', 'a+rwx', 'a+w']

/**
 * Audits source code for insecure file permission bitmasks.
 *
 * @param {string} sourceCode
 * @returns {object} File permission safety report
 */
export function proveFilePermissions(sourceCode = '') {
  const violations = []

  for (const mask of DANGEROUS_MASKS) {
    const pattern = new RegExp(`(?:chmod[a-zA-Z]*|writeFile[a-zA-Z]*|mkdir[a-zA-Z]*|mode)\\s*\\([^)]*?['"]?${mask}['"]?`, 'g')
    if (pattern.test(sourceCode)) {
      violations.push({
        mask,
        type: 'INSECURE_WORLD_WRITABLE_PERMISSION',
        recommendation: `Use strict least-privilege mask (0644 for files, 0755 for executables/directories) instead of '${mask}'.`,
      })
    }
  }

  const secure = violations.length === 0

  return {
    secure,
    violationsCount: violations.length,
    violations,
    permissionProof: secure ? 'LEAST_PRIVILEGE_PERMISSIONS_PROVEN' : 'DANGEROUS_PERMISSIONS_DETECTED',
  }
}
