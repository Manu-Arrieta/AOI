/**
 * scripts/aoi-os/config-guard/dead-tsconfig-erasable-syntax-only-pruner.mjs
 *
 * Deterministic Dead tsconfig.json erasableSyntaxOnly Pruner for AOI-OS:
 * Audits tsconfig.json compilerOptions for TypeScript 5.8+ erasableSyntaxOnly: true,
 * ensuring incompatible legacy flags (experimentalDecorators / emitDecoratorMetadata)
 * are pruned/repaired for Node.js native type stripping (0 LLM Tokens).
 */

/**
 * Audits and cleans tsconfig.json compilerOptions regarding erasableSyntaxOnly.
 *
 * @param {object} tsconfigJson - Parsed tsconfig.json object
 * @returns {object} Audit report with pruned tsconfig and proof
 */
export function auditDeadTsconfigErasableSyntaxOnly(tsconfigJson = {}) {
  const compilerOptions = tsconfigJson.compilerOptions || {}
  const hasErasableSyntaxOnly = compilerOptions.erasableSyntaxOnly === true
  const hasExperimentalDecorators = compilerOptions.experimentalDecorators === true
  const hasEmitDecoratorMetadata = compilerOptions.emitDecoratorMetadata === true

  let isInvalid = false
  const reasons = []

  if (hasErasableSyntaxOnly) {
    if (hasExperimentalDecorators) {
      isInvalid = true
      reasons.push('erasableSyntaxOnly: true is incompatible with experimentalDecorators: true')
    }
    if (hasEmitDecoratorMetadata) {
      isInvalid = true
      reasons.push('erasableSyntaxOnly: true is incompatible with emitDecoratorMetadata: true')
    }
  }

  const cleanedCompilerOptions = { ...compilerOptions }
  if (hasErasableSyntaxOnly && isInvalid) {
    delete cleanedCompilerOptions.experimentalDecorators
    delete cleanedCompilerOptions.emitDecoratorMetadata
  }

  const prunedTsconfig = {
    ...tsconfigJson,
    compilerOptions: cleanedCompilerOptions,
  }

  return {
    clean: !isInvalid,
    hasErasableSyntaxOnly,
    isInvalid,
    reasons,
    prunedTsconfig,
    erasableSyntaxProof: isInvalid
      ? 'INCOMPATIBLE_ERASABLE_SYNTAX_FLAGS_PRUNED'
      : 'TSCONFIG_ERASABLE_SYNTAX_VALID',
  }
}
