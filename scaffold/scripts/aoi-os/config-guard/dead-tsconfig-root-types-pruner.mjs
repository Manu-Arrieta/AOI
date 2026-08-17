/**
 * scripts/aoi-os/config-guard/dead-tsconfig-root-types-pruner.mjs
 *
 * Deterministic Dead TypeScript Root Types Leakage Pruner for AOI-OS:
 * Statically audits compilerOptions in tsconfig.json for frontend/browser targets to detect and prune
 * leaking Node.js type definitions (e.g. types: ['node']) from client-only codebases, preventing
 * accidental usage of Node globals (Buffer, process, fs) in the browser (0 LLM Tokens).
 */

/**
 * Audits tsconfig.json compilerOptions for leaking Node types in frontend projects.
 *
 * @param {object} tsconfigJson - Parsed tsconfig.json object
 * @param {boolean} [isFrontendPackage=false] - Flag indicating if package is frontend/client-only
 * @returns {object} Root types leakage audit report
 */
export function auditDeadTsconfigRootTypes(tsconfigJson = {}, isFrontendPackage = false) {
  const deadTypes = []
  const compilerOptions = tsconfigJson?.compilerOptions || {}

  const types = Array.isArray(compilerOptions.types) ? compilerOptions.types : []
  const lib = Array.isArray(compilerOptions.lib) ? compilerOptions.lib.map((l) => l.toLowerCase()) : []
  const isBrowserDom = lib.some((l) => l.includes('dom')) || isFrontendPackage

  if (isBrowserDom && types.length > 0) {
    for (const t of types) {
      if (t.toLowerCase() === 'node') {
        deadTypes.push({
          type: t,
          error: 'NODE_TYPES_LEAKING_INTO_FRONTEND',
          recommendation: `compilerOptions.types includes '${t}' in a frontend/browser configuration. Prune 'node' types from client tsconfig to avoid polluting client global scope with Node APIs (Buffer, process).`,
        })
      }
    }
  }

  const clean = deadTypes.length === 0

  return {
    clean,
    isBrowserDom,
    deadCount: deadTypes.length,
    deadTypes,
    rootTypesProof: clean ? 'FRONTEND_TYPES_CONFINED' : 'NODE_GLOBAL_TYPES_LEAKAGE_DETECTED',
  }
}
