/**
 * scripts/aoi-os/config-guard/dead-tsconfig-rewrite-relative-import-extensions-pruner.mjs
 *
 * Deterministic Dead tsconfig.json rewriteRelativeImportExtensions Pruner for AOI-OS:
 * Audits tsconfig.json compilerOptions for TypeScript 5.7+ rewriteRelativeImportExtensions: true,
 * ensuring incompatible legacy moduleResolution (classic/node10) is upgraded to bundler/nodenext (0 LLM Tokens).
 */

const VALID_MODULE_RESOLUTIONS = ['bundler', 'node16', 'nodenext', 'preserve']

/**
 * Audits and cleans tsconfig.json compilerOptions regarding rewriteRelativeImportExtensions.
 *
 * @param {object} tsconfigJson - Parsed tsconfig.json object
 * @returns {object} Audit report with pruned tsconfig and proof
 */
export function auditDeadTsconfigRewriteRelativeImportExtensions(tsconfigJson = {}) {
  const compilerOptions = tsconfigJson.compilerOptions || {}
  const hasRewrite = compilerOptions.rewriteRelativeImportExtensions === true
  const rawResolution = (compilerOptions.moduleResolution || '').toLowerCase()

  let isInvalid = false
  const reasons = []

  if (hasRewrite) {
    if (!rawResolution || !VALID_MODULE_RESOLUTIONS.includes(rawResolution)) {
      isInvalid = true
      reasons.push(
        `rewriteRelativeImportExtensions: true requires modern moduleResolution (bundler/node16/nodenext), found: "${compilerOptions.moduleResolution}"`
      )
    }
  }

  const cleanedCompilerOptions = { ...compilerOptions }
  if (hasRewrite && isInvalid) {
    cleanedCompilerOptions.moduleResolution = 'bundler'
  }

  const prunedTsconfig = {
    ...tsconfigJson,
    compilerOptions: cleanedCompilerOptions,
  }

  return {
    clean: !isInvalid,
    hasRewrite,
    isInvalid,
    reasons,
    prunedTsconfig,
    rewriteRelativeImportProof: isInvalid
      ? 'INVALID_REWRITE_IMPORT_EXTENSIONS_REPAIRED_WITH_BUNDLER'
      : 'TSCONFIG_REWRITE_RELATIVE_IMPORT_EXTENSIONS_VALID',
  }
}
