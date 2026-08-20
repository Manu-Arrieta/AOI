/**
 * scripts/aoi-os/config-guard/dead-tsconfig-check-js-allow-js-dependency-pruner.mjs
 *
 * Deterministic Dead tsconfig.json checkJs/allowJs Dependency Pruner for AOI-OS:
 * Audits tsconfig.json compilerOptions to ensure that `checkJs: true` is accompanied by `allowJs: true`,
 * preventing TypeScript compiler error TS5052 and sanitizing hybrid JavaScript/TypeScript compilation (0 LLM Tokens).
 */

/**
 * Audits and cleans tsconfig.json compilerOptions regarding checkJs and allowJs dependencies.
 *
 * @param {object} tsconfigJson - Parsed tsconfig.json object
 * @returns {object} Audit report with pruned tsconfig and proof
 */
export function auditDeadTsconfigCheckJsAllowJsDependency(tsconfigJson = {}) {
  const compilerOptions = tsconfigJson.compilerOptions || {}
  const hasCheckJs = compilerOptions.checkJs === true
  const hasAllowJs = compilerOptions.allowJs === true

  let isInvalid = false
  const reasons = []

  if (hasCheckJs && !hasAllowJs) {
    isInvalid = true
    reasons.push(
      "Option 'checkJs: true' cannot be specified without 'allowJs: true' (TS5052)"
    )
  }

  const cleanedCompilerOptions = { ...compilerOptions }
  if (hasCheckJs && isInvalid) {
    cleanedCompilerOptions.allowJs = true
  }

  const prunedTsconfig = {
    ...tsconfigJson,
    compilerOptions: cleanedCompilerOptions,
  }

  return {
    clean: !isInvalid,
    hasCheckJs,
    hasAllowJs: hasCheckJs ? true : hasAllowJs,
    isInvalid,
    reasons,
    prunedTsconfig,
    checkJsAllowJsProof: isInvalid
      ? 'INVALID_CHECK_JS_WITHOUT_ALLOW_JS_REPAIRED'
      : 'TSCONFIG_CHECK_JS_ALLOW_JS_DEPENDENCY_VALID',
  }
}
