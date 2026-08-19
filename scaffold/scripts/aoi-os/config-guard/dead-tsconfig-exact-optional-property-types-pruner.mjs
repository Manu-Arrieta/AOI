/**
 * scripts/aoi-os/config-guard/dead-tsconfig-exact-optional-property-types-pruner.mjs
 *
 * Deterministic Dead tsconfig.json exactOptionalPropertyTypes Pruner for AOI-OS:
 * Audits tsconfig.json compilerOptions for exactOptionalPropertyTypes: true,
 * ensuring strict mode is active and pruning deprecated index suppression flags (0 LLM Tokens).
 */

/**
 * Audits and cleans tsconfig.json compilerOptions regarding exactOptionalPropertyTypes.
 *
 * @param {object} tsconfigJson - Parsed tsconfig.json object
 * @returns {object} Audit report with pruned tsconfig and proof
 */
export function auditDeadTsconfigExactOptionalPropertyTypes(tsconfigJson = {}) {
  const compilerOptions = tsconfigJson.compilerOptions || {}
  const hasExactOptional = compilerOptions.exactOptionalPropertyTypes === true

  let isInvalid = false
  const reasons = []

  if (hasExactOptional) {
    if (compilerOptions.strict !== true && compilerOptions.strictNullChecks !== true) {
      isInvalid = true
      reasons.push(
        'exactOptionalPropertyTypes: true requires strict: true or strictNullChecks: true'
      )
    }
    if (compilerOptions.suppressImplicitAnyIndexErrors !== undefined) {
      isInvalid = true
      reasons.push(
        'suppressImplicitAnyIndexErrors is deprecated in TS 5.5+ and incompatible with exactOptionalPropertyTypes'
      )
    }
  }

  const cleanedCompilerOptions = { ...compilerOptions }
  if (hasExactOptional && isInvalid) {
    if (cleanedCompilerOptions.strict !== true && cleanedCompilerOptions.strictNullChecks !== true) {
      cleanedCompilerOptions.strict = true
    }
    delete cleanedCompilerOptions.suppressImplicitAnyIndexErrors
  }

  const prunedTsconfig = {
    ...tsconfigJson,
    compilerOptions: cleanedCompilerOptions,
  }

  return {
    clean: !isInvalid,
    hasExactOptional,
    isInvalid,
    reasons,
    prunedTsconfig,
    exactOptionalProof: isInvalid
      ? 'EXACT_OPTIONAL_PROPERTY_TYPES_REPAIRED'
      : 'TSCONFIG_EXACT_OPTIONAL_PROPERTY_TYPES_VALID',
  }
}
