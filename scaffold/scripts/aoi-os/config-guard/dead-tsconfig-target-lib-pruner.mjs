/**
 * scripts/aoi-os/config-guard/dead-tsconfig-target-lib-pruner.mjs
 *
 * Deterministic Dead TypeScript Target-Lib Consistency Pruner for AOI-OS:
 * Statically audits compilerOptions in tsconfig.json to prune redundant lib entries that exactly duplicate
 * the specified target (e.g. target: 'ES2022' with lib: ['ES2022']), streamlining tsconfig.json and
 * optimizing TypeScript compiler and language server AST initialization (0 LLM Tokens).
 */

/**
 * Audits tsconfig.json compilerOptions for redundant target-matching lib entries.
 *
 * @param {object} tsconfigJson - Parsed tsconfig.json object
 * @returns {object} Target-lib consistency report
 */
export function auditDeadTsconfigTargetLib(tsconfigJson = {}) {
  const deadLibs = []
  const compilerOptions = tsconfigJson?.compilerOptions || {}

  const target = (compilerOptions.target || '').toLowerCase()
  const libs = Array.isArray(compilerOptions.lib) ? compilerOptions.lib : []

  if (target && libs.length > 0) {
    for (const lib of libs) {
      if (lib.toLowerCase() === target) {
        deadLibs.push({
          lib,
          target: compilerOptions.target,
          error: 'REDUNDANT_TARGET_MATCHING_LIB',
          recommendation: `compilerOptions.lib entry '${lib}' is redundant because 'target: "${compilerOptions.target}"' automatically defaults lib to '${compilerOptions.target}'. Prune this lib entry.`,
        })
      }
    }
  }

  const clean = deadLibs.length === 0

  return {
    clean,
    target: compilerOptions.target,
    deadCount: deadLibs.length,
    deadLibs,
    targetLibProof: clean ? 'TARGET_LIB_CANONICAL' : 'REDUNDANT_TARGET_LIB_DETECTED',
  }
}
