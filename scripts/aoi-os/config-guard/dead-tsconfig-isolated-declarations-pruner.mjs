/**
 * scripts/aoi-os/config-guard/dead-tsconfig-isolated-declarations-pruner.mjs
 *
 * Deterministic Dead tsconfig.json isolatedDeclarations Pruner for AOI-OS:
 * Audits tsconfig.json compilerOptions for TypeScript 5.5+ isolatedDeclarations: true,
 * verifying that declaration: true or composite: true is active to eliminate TS5110/TS5111 (0 LLM Tokens).
 */

/**
 * Audits and cleans tsconfig.json compilerOptions regarding isolatedDeclarations.
 *
 * @param {object} tsconfigJson - Parsed tsconfig.json object
 * @returns {object} Audit report with pruned tsconfig and proof
 */
export function auditDeadTsconfigIsolatedDeclarations(tsconfigJson = {}) {
  const compilerOptions = tsconfigJson.compilerOptions || {}
  const hasIsolatedDeclarations = compilerOptions.isolatedDeclarations === true
  const hasDeclaration = compilerOptions.declaration === true
  const hasComposite = compilerOptions.composite === true

  let isInvalid = false
  const reasons = []

  if (hasIsolatedDeclarations && !hasDeclaration && !hasComposite) {
    isInvalid = true
    reasons.push('isolatedDeclarations: true requires declaration: true or composite: true (TS5110)')
  }

  const cleanedCompilerOptions = { ...compilerOptions }
  if (isInvalid) {
    cleanedCompilerOptions.declaration = true
  }

  const prunedTsconfig = {
    ...tsconfigJson,
    compilerOptions: cleanedCompilerOptions,
  }

  return {
    clean: !isInvalid,
    hasIsolatedDeclarations,
    isInvalid,
    reasons,
    prunedTsconfig,
    isolatedDeclarationsProof: isInvalid
      ? 'INVALID_ISOLATED_DECLARATIONS_REPAIRED_WITH_DECLARATION'
      : 'TSCONFIG_ISOLATED_DECLARATIONS_VALID',
  }
}
