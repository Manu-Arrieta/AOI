/**
 * scripts/aoi-os/config-guard/dead-tsconfig-json-module-pruner.mjs
 *
 * Deterministic Dead TypeScript resolveJsonModule Pruner for AOI-OS:
 * Statically audits compilerOptions in tsconfig.json to detect and prune redundant resolveJsonModule: true
 * declarations when modern moduleResolution (bundler, node16, nodenext) is already configured,
 * keeping tsconfig.json canonical and reducing compiler memory overhead (0 LLM Tokens).
 */

/**
 * Audits tsconfig.json compilerOptions for redundant resolveJsonModule declarations.
 *
 * @param {object} tsconfigJson - Parsed tsconfig.json object
 * @returns {object} resolveJsonModule redundancy audit report
 */
export function auditDeadTsconfigJsonModule(tsconfigJson = {}) {
  const deadFlags = []
  const compilerOptions = tsconfigJson?.compilerOptions || {}

  const moduleResolution = (compilerOptions.moduleResolution || '').toLowerCase()
  const resolveJsonModule = compilerOptions.resolveJsonModule === true

  const modernResolutions = ['bundler', 'node16', 'nodenext']

  if (resolveJsonModule && modernResolutions.includes(moduleResolution)) {
    deadFlags.push({
      flag: 'resolveJsonModule',
      moduleResolution: compilerOptions.moduleResolution,
      error: 'REDUNDANT_RESOLVE_JSON_MODULE',
      recommendation: `'resolveJsonModule: true' is redundant because 'moduleResolution: "${compilerOptions.moduleResolution}"' natively supports JSON module resolution. Prune this flag to keep compilerOptions concise.`,
    })
  }

  const clean = deadFlags.length === 0

  return {
    clean,
    moduleResolution: compilerOptions.moduleResolution,
    deadCount: deadFlags.length,
    deadFlags,
    jsonModuleProof: clean ? 'TSCONFIG_JSON_MODULE_CANONICAL' : 'REDUNDANT_RESOLVE_JSON_MODULE_DETECTED',
  }
}
