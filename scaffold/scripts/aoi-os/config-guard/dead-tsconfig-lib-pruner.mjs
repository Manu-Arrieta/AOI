/**
 * scripts/aoi-os/config-guard/dead-tsconfig-lib-pruner.mjs
 *
 * Deterministic Dead TypeScript Compiler Options lib Pruner for AOI-OS:
 * Statically audits compilerOptions.lib in tsconfig.json against target environment
 * to prune redundant, duplicate, or contradictory library definitions (e.g. DOM in pure Node backend),
 * optimizing compiler memory and LSP type-checking performance (0 LLM Tokens).
 */

/**
 * Audits tsconfig.json "compilerOptions.lib" for redundant or contradictory libraries.
 *
 * @param {object} tsconfigJson - Parsed tsconfig.json object
 * @param {object} [options] - Options
 * @param {boolean} [options.isNodeOnly=false] - True if environment is pure Node.js backend
 * @returns {object} TS lib audit report
 */
export function auditDeadTsconfigLibs(tsconfigJson = {}, options = {}) {
  const deadLibs = []
  const libList = Array.isArray(tsconfigJson?.compilerOptions?.lib) ? tsconfigJson.compilerOptions.lib : []
  const isNodeOnly = options.isNodeOnly ?? false

  const seen = new Set()
  for (const lib of libList) {
    if (typeof lib === 'string') {
      const lower = lib.toLowerCase()

      // Duplicate check
      if (seen.has(lower)) {
        deadLibs.push({
          lib,
          error: 'DUPLICATE_TSCONFIG_LIB_ENTRY',
          recommendation: `Duplicate lib entry '${lib}' found in tsconfig.json compilerOptions.lib. Prune duplicate.`,
        })
      }
      seen.add(lower)

      // DOM in pure Node check
      if (isNodeOnly && (lower === 'dom' || lower === 'dom.iterable')) {
        deadLibs.push({
          lib,
          error: 'INCOMPATIBLE_DOM_LIB_IN_NODE_PROJECT',
          recommendation: `Browser lib '${lib}' declared in pure Node.js project. Prune to avoid type pollution with global DOM types.`,
        })
      }
    }
  }

  const clean = deadLibs.length === 0

  return {
    clean,
    deadCount: deadLibs.length,
    deadLibs,
    libProof: clean ? 'TSCONFIG_LIBS_CANONICAL' : 'DEAD_OR_INCOMPATIBLE_TSCONFIG_LIBS_DETECTED',
  }
}
