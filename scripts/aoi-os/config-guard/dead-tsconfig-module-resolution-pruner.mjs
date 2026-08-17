/**
 * scripts/aoi-os/config-guard/dead-tsconfig-module-resolution-pruner.mjs
 *
 * Deterministic Dead tsconfig.json Incompatible ModuleResolution Pruner for AOI-OS:
 * Audits tsconfig.json compilerOptions to detect and prune obsolete or incompatible
 * combinations of module and moduleResolution (e.g. module: 'node16'/'nodenext'/'preserve' with
 * moduleResolution: 'classic'/'node10' or module: 'esnext' with 'classic') to prevent TS5095/TS5109 (0 LLM Tokens).
 */

const MODERN_MODULES = ['node16', 'nodenext', 'preserve', 'esnext']
const INCOMPATIBLE_RESOLUTIONS = ['classic', 'node10', 'node']

/**
 * Audits and prunes incompatible moduleResolution settings in tsconfig.json.
 *
 * @param {object} tsconfigJson - tsconfig JSON object
 * @returns {object} Audit report and cleaned tsconfig
 */
export function auditDeadTsconfigModuleResolution(tsconfigJson = {}) {
  const compilerOptions = tsconfigJson.compilerOptions || {}
  const rawModule = (compilerOptions.module || '').toLowerCase()
  const rawResolution = (compilerOptions.moduleResolution || '').toLowerCase()

  let hasIncompatibleResolution = false
  const reasons = []

  if (MODERN_MODULES.includes(rawModule) && INCOMPATIBLE_RESOLUTIONS.includes(rawResolution)) {
    hasIncompatibleResolution = true
    reasons.push(`module: '${compilerOptions.module}' is incompatible with legacy moduleResolution: '${compilerOptions.moduleResolution}'`)
  }

  const cleanedCompilerOptions = { ...compilerOptions }
  if (hasIncompatibleResolution) {
    if (rawModule === 'node16' || rawModule === 'nodenext' || rawModule === 'preserve') {
      delete cleanedCompilerOptions.moduleResolution
    } else if (rawModule === 'esnext') {
      cleanedCompilerOptions.moduleResolution = 'bundler'
    }
  }

  const prunedTsconfig = {
    ...tsconfigJson,
    compilerOptions: cleanedCompilerOptions,
  }

  return {
    clean: !hasIncompatibleResolution,
    hasIncompatibleResolution,
    reasons,
    prunedTsconfig,
    moduleResolutionProof: hasIncompatibleResolution
      ? 'INCOMPATIBLE_MODULE_RESOLUTION_PRUNED'
      : 'TSCONFIG_MODULE_RESOLUTION_VALID',
  }
}
