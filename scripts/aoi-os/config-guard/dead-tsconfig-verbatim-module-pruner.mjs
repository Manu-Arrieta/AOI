/**
 * scripts/aoi-os/config-guard/dead-tsconfig-verbatim-module-pruner.mjs
 *
 * Deterministic Dead TypeScript Verbatim Module Syntax Pruner for AOI-OS:
 * Statically audits compilerOptions in tsconfig.json to detect and prune deprecated/redundant
 * importsNotUsedAsValues and preserveValueImports flags when modern verbatimModuleSyntax: true
 * is configured, preventing TS5095/TS5096 compiler errors (0 LLM Tokens).
 */

/**
 * Audits tsconfig.json compilerOptions for deprecated import flags when verbatimModuleSyntax is active.
 *
 * @param {object} tsconfigJson - Parsed tsconfig.json object
 * @returns {object} Verbatim module syntax audit report
 */
export function auditDeadTsconfigVerbatimModule(tsconfigJson = {}) {
  const deadDirectives = []
  const compilerOptions = tsconfigJson?.compilerOptions || {}

  const hasVerbatimModuleSyntax = compilerOptions.verbatimModuleSyntax === true

  if (hasVerbatimModuleSyntax) {
    if (compilerOptions.importsNotUsedAsValues !== undefined) {
      deadDirectives.push({
        directive: `importsNotUsedAsValues: "${compilerOptions.importsNotUsedAsValues}"`,
        error: 'DEPRECATED_IMPORTS_NOT_USED_AS_VALUES_FLAG',
        recommendation: "compilerOptions.importsNotUsedAsValues is superseded by verbatimModuleSyntax: true and produces a compiler error in TS 5.0+. Prune 'importsNotUsedAsValues'.",
      })
    }

    if (compilerOptions.preserveValueImports !== undefined) {
      deadDirectives.push({
        directive: `preserveValueImports: ${compilerOptions.preserveValueImports}`,
        error: 'DEPRECATED_PRESERVE_VALUE_IMPORTS_FLAG',
        recommendation: "compilerOptions.preserveValueImports is superseded by verbatimModuleSyntax: true and produces a compiler error in TS 5.0+. Prune 'preserveValueImports'.",
      })
    }
  }

  const clean = deadDirectives.length === 0

  return {
    clean,
    hasVerbatimModuleSyntax,
    deadCount: deadDirectives.length,
    deadDirectives,
    verbatimProof: clean ? 'TSCONFIG_VERBATIM_MODULE_SYNTAX_CLEAN' : 'DEPRECATED_IMPORT_FLAGS_DETECTED',
  }
}
