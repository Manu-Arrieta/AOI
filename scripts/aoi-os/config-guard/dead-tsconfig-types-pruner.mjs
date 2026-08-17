/**
 * scripts/aoi-os/config-guard/dead-tsconfig-types-pruner.mjs
 *
 * Deterministic Dead Monorepo tsconfig Compiler Options types Pruner for AOI-OS:
 * Statically audits compilerOptions.types array in tsconfig.json against installed dependencies/types
 * to prune dead or uninstalled type packages that cause TypeScript initialization errors (0 LLM Tokens).
 */

/**
 * Audits tsconfig.json compilerOptions.types against installed type packages.
 *
 * @param {object} tsconfigJson - Parsed tsconfig.json object
 * @param {string[]} availableTypePackages - Array of installed package/types names (e.g. ['node', 'vitest'])
 * @returns {object} TS types compilerOptions audit report
 */
export function auditDeadTsconfigTypes(tsconfigJson = {}, availableTypePackages = []) {
  const deadTypes = []
  const declaredTypes = tsconfigJson?.compilerOptions?.types
  const typesList = Array.isArray(declaredTypes) ? declaredTypes : []
  const availableSet = new Set(availableTypePackages.map((t) => t.replace(/^@types\//, '')))

  for (const typeName of typesList) {
    if (typeof typeName === 'string') {
      const cleanName = typeName.replace(/^@types\//, '')
      if (!availableSet.has(cleanName)) {
        deadTypes.push({
          type: typeName,
          error: 'UNINSTALLED_TSCONFIG_TYPE_PACKAGE',
          recommendation: `Type package '${typeName}' declared in compilerOptions.types is not installed. Install '@types/${typeName}' or prune from tsconfig.json.`,
        })
      }
    }
  }

  const clean = deadTypes.length === 0

  return {
    clean,
    deadCount: deadTypes.length,
    deadTypes,
    typesProof: clean ? 'TSCONFIG_TYPES_ARRAY_CANONICAL' : 'DEAD_TSCONFIG_TYPES_DETECTED',
  }
}
