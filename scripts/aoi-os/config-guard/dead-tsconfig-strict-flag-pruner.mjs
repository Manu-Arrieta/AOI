/**
 * scripts/aoi-os/config-guard/dead-tsconfig-strict-flag-pruner.mjs
 *
 * Deterministic Dead TypeScript Redundant Strict Sub-Flags Pruner for AOI-OS:
 * Statically audits compilerOptions in tsconfig.json to prune redundant strict family sub-flags
 * (noImplicitAny, strictNullChecks, strictFunctionTypes, etc.) when strict: true is already enabled,
 * keeping tsconfig.json clean, canonical, and avoiding redundant flag processing (0 LLM Tokens).
 */

const STRICT_SUB_FLAGS = [
  'noImplicitAny',
  'noImplicitThis',
  'strictNullChecks',
  'strictFunctionTypes',
  'strictBindCallApply',
  'strictPropertyInitialization',
  'alwaysStrict',
  'useUnknownInCatchVariables',
]

/**
 * Audits tsconfig.json compilerOptions for redundant strict sub-flags.
 *
 * @param {object} tsconfigJson - Parsed tsconfig.json object
 * @returns {object} Strict flags audit report
 */
export function auditDeadTsconfigStrictFlags(tsconfigJson = {}) {
  const deadFlags = []
  const compilerOptions = tsconfigJson?.compilerOptions || {}

  const isStrict = compilerOptions.strict === true

  if (isStrict) {
    for (const flag of STRICT_SUB_FLAGS) {
      if (compilerOptions[flag] === true) {
        deadFlags.push({
          flag,
          value: true,
          error: 'REDUNDANT_STRICT_SUB_FLAG',
          recommendation: `compilerOptions.${flag} is redundant when 'strict: true' is enabled. Prune it to keep tsconfig.json canonical.`,
        })
      }
    }
  }

  const clean = deadFlags.length === 0

  return {
    clean,
    isStrict,
    deadCount: deadFlags.length,
    deadFlags,
    strictProof: clean ? 'TSCONFIG_STRICT_FLAGS_CANONICAL' : 'REDUNDANT_STRICT_SUB_FLAGS_DETECTED',
  }
}
