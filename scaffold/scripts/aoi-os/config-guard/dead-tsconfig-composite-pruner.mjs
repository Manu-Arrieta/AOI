/**
 * scripts/aoi-os/config-guard/dead-tsconfig-composite-pruner.mjs
 *
 * Deterministic Dead TypeScript Composite Project Redundancy Pruner for AOI-OS:
 * Statically audits compilerOptions in tsconfig.json to detect and prune invalid/redundant composite: true
 * declarations when declaration: false is explicitly set (composite mandates declaration: true in TS 5.0+),
 * eliminating TS5069 / TS6307 compiler errors (0 LLM Tokens).
 */

/**
 * Audits tsconfig.json compilerOptions for invalid composite: true configurations when declaration is disabled.
 *
 * @param {object} tsconfigJson - Parsed tsconfig.json object
 * @returns {object} Composite configuration audit report
 */
export function auditDeadTsconfigComposite(tsconfigJson = {}) {
  const deadDirectives = []
  const compilerOptions = tsconfigJson?.compilerOptions || {}

  const hasComposite = compilerOptions.composite === true
  const isDeclarationDisabled = compilerOptions.declaration === false

  if (hasComposite && isDeclarationDisabled) {
    deadDirectives.push({
      directive: 'composite: true',
      error: 'COMPOSITE_REQUIRES_DECLARATION_TRUE',
      recommendation: "compilerOptions.composite is set to true but declaration is explicitly false. TypeScript composite project references require declaration: true (TS5069). Prune 'composite: true' or enable 'declaration: true'.",
    })
  }

  const clean = deadDirectives.length === 0

  return {
    clean,
    hasComposite,
    isDeclarationDisabled,
    deadCount: deadDirectives.length,
    deadDirectives,
    compositeProof: clean ? 'TSCONFIG_COMPOSITE_VALID' : 'INVALID_COMPOSITE_DECLARATION_CONFLICT',
  }
}
