/**
 * scripts/aoi-os/config-guard/dead-tsconfig-exact-optional-pruner.mjs
 *
 * Deterministic Dead TypeScript Exact Optional Property Types Pruner for AOI-OS:
 * Statically audits compilerOptions in tsconfig.json to detect and prune redundant
 * exactOptionalPropertyTypes: false declarations when strict: false or omitted is configured,
 * eliminating dead compiler flags and promoting canonical strict type safety (0 LLM Tokens).
 */

/**
 * Audits tsconfig.json compilerOptions for redundant exactOptionalPropertyTypes: false settings.
 *
 * @param {object} tsconfigJson - Parsed tsconfig.json object
 * @returns {object} Exact optional properties audit report
 */
export function auditDeadTsconfigExactOptional(tsconfigJson = {}) {
  const deadDirectives = []
  const compilerOptions = tsconfigJson?.compilerOptions || {}

  const hasExactOptionalFalse = compilerOptions.exactOptionalPropertyTypes === false
  const isStrict = compilerOptions.strict === true

  if (hasExactOptionalFalse && !isStrict) {
    deadDirectives.push({
      directive: 'exactOptionalPropertyTypes: false',
      error: 'REDUNDANT_EXACT_OPTIONAL_PROPERTY_TYPES_FLAG',
      recommendation: "compilerOptions.exactOptionalPropertyTypes is explicitly set to false in a non-strict tsconfig (where false is already default). Prune 'exactOptionalPropertyTypes: false' or consider enabling strict type checking.",
    })
  }

  const clean = deadDirectives.length === 0

  return {
    clean,
    hasExactOptionalFalse,
    isStrict,
    deadCount: deadDirectives.length,
    deadDirectives,
    exactOptionalProof: clean ? 'TSCONFIG_EXACT_OPTIONAL_CANONICAL' : 'REDUNDANT_EXACT_OPTIONAL_DETECTED',
  }
}
