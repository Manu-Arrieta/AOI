/**
 * scripts/aoi-os/config-guard/dead-tsconfig-reference-pruner.mjs
 *
 * Deterministic Dead TypeScript Project Reference Pruner for AOI-OS:
 * Statically audits "references" array entries in tsconfig.json against existing workspace
 * directory paths to prune dead or broken project references before tsc -b compilation (0 LLM Tokens).
 */

/**
 * Audits tsconfig.json project references against valid existing directories/files.
 *
 * @param {object} tsconfigJson - Parsed tsconfig.json object
 * @param {string[]} existingProjectPaths - Array of valid relative directory/file paths
 * @returns {object} TS project reference audit report
 */
export function auditDeadTsconfigReferences(tsconfigJson = {}, existingProjectPaths = []) {
  const deadReferences = []
  const references = Array.isArray(tsconfigJson.references) ? tsconfigJson.references : []
  const validSet = new Set(existingProjectPaths.map((p) => p.replace(/^\.\//, '').replace(/\/tsconfig\.json$/, '')))

  for (const ref of references) {
    const rawPath = typeof ref === 'string' ? ref : ref.path
    if (typeof rawPath === 'string') {
      const normalized = rawPath.replace(/^\.\//, '').replace(/\/tsconfig\.json$/, '')
      if (!validSet.has(normalized)) {
        deadReferences.push({
          path: rawPath,
          error: 'ORPHAN_TSCONFIG_PROJECT_REFERENCE',
          recommendation: `TypeScript project reference path '${rawPath}' does not exist. Update or prune from 'references'.`,
        })
      }
    }
  }

  const clean = deadReferences.length === 0

  return {
    clean,
    deadCount: deadReferences.length,
    deadReferences,
    referenceProof: clean ? 'TSCONFIG_PROJECT_REFERENCES_CANONICAL' : 'DEAD_TSCONFIG_REFERENCES_DETECTED',
  }
}
