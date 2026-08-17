/**
 * scripts/aoi-os/config-guard/dead-tsconfig-checkjs-pruner.mjs
 *
 * Deterministic Dead TypeScript CheckJs Redundancy Pruner for AOI-OS:
 * Statically audits compilerOptions in tsconfig.json to detect and prune redundant checkJs: true
 * declarations when allowJs: false or omitted is configured (since checkJs is inert without allowJs),
 * eliminating dead compiler flags and clarifying project configuration (0 LLM Tokens).
 */

/**
 * Audits tsconfig.json compilerOptions for inert checkJs: true declarations when allowJs is not active.
 *
 * @param {object} tsconfigJson - Parsed tsconfig.json object
 * @returns {object} CheckJs configuration audit report
 */
export function auditDeadTsconfigCheckJs(tsconfigJson = {}) {
  const deadDirectives = []
  const compilerOptions = tsconfigJson?.compilerOptions || {}

  const hasCheckJs = compilerOptions.checkJs === true
  const hasAllowJs = compilerOptions.allowJs === true

  if (hasCheckJs && !hasAllowJs) {
    deadDirectives.push({
      directive: 'checkJs: true',
      error: 'INERT_CHECK_JS_WITHOUT_ALLOW_JS',
      recommendation: "compilerOptions.checkJs is set to true but allowJs is false or omitted. checkJs has no effect without allowJs: true. Prune 'checkJs: true' or enable 'allowJs: true' if JavaScript files need type-checking.",
    })
  }

  const clean = deadDirectives.length === 0

  return {
    clean,
    hasCheckJs,
    hasAllowJs,
    deadCount: deadDirectives.length,
    deadDirectives,
    checkJsProof: clean ? 'TSCONFIG_CHECK_JS_CONSISTENT' : 'INERT_CHECK_JS_DETECTED',
  }
}
