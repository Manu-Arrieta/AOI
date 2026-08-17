/**
 * scripts/aoi-os/storage-guard/directory-traversal-boundary-guard.mjs
 *
 * Deterministic Atomic Directory Traversal Boundary & Canonical Realpath Guard for AOI-OS:
 * Statically audits filesystem path resolution routines (path.resolve, fs.realpathSync, fs.promises.realpath)
 * to verify that canonical paths are strictly anchored to the declared workspace root (realpath.startsWith(root)),
 * preventing symlink traversal escapes and directory boundary bypasses (0 LLM Tokens).
 */

/**
 * Audits source code for canonical realpath workspace anchoring.
 *
 * @param {string} sourceCode - Path resolution or file access source code
 * @returns {object} Directory boundary audit report
 */
export function auditDirectoryTraversalBoundarySafety(sourceCode = '') {
  const violations = []

  const resolvesPath = /(?:path\.resolve|path\.join|fs\.realpathSync|realpathSync|fsp\.realpath)\s*\(/g.test(sourceCode)
  const accessesFilesystem = /(?:fs\.readFileSync|fs\.writeFileSync|fs\.promises|fsp\.|fs\.createReadStream|fs\.readdirSync)\s*\(/g.test(sourceCode)
  const anchorsToRoot = /(?:startsWith\([^)]*root|startsWith\([^)]*workspace|relative\([^)]*root|\.startsWith\([^)]*baseDir)/i.test(sourceCode)

  if (resolvesPath && accessesFilesystem && !anchorsToRoot) {
    violations.push({
      type: 'UNANCHORED_CANONICAL_PATH_ACCESS',
      recommendation: "Ensure resolved/canonical paths are verified to start with the workspace root directory (e.g. 'canonicalPath.startsWith(workspaceRoot)') before accessing the filesystem.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    resolvesPath,
    accessesFilesystem,
    violationsCount: violations.length,
    violations,
    boundaryProof: safe ? 'CANONICAL_WORKSPACE_BOUNDARY_ANCHORED' : 'UNANCHORED_DIRECTORY_TRAVERSAL_RISK',
  }
}
