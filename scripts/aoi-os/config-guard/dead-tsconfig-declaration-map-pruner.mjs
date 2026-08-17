/**
 * scripts/aoi-os/config-guard/dead-tsconfig-declaration-map-pruner.mjs
 *
 * Deterministic Dead TypeScript Declaration Map Consistency Pruner for AOI-OS:
 * Statically audits compilerOptions in tsconfig.json to detect and prune declarationMap: true
 * when declaration: false or omitted is configured, eliminating dead compiler directives that
 * have zero effect without .d.ts generation (0 LLM Tokens).
 */

/**
 * Audits tsconfig.json compilerOptions for orphan declarationMap directives.
 *
 * @param {object} tsconfigJson - Parsed tsconfig.json object
 * @returns {object} Declaration map consistency audit report
 */
export function auditDeadTsconfigDeclarationMap(tsconfigJson = {}) {
  const deadDirectives = []
  const compilerOptions = tsconfigJson?.compilerOptions || {}

  const hasDeclarationMap = compilerOptions.declarationMap === true
  const hasDeclaration = compilerOptions.declaration === true

  if (hasDeclarationMap && !hasDeclaration) {
    deadDirectives.push({
      directive: 'declarationMap: true',
      error: 'ORPHAN_DECLARATION_MAP_WITHOUT_DECLARATION',
      recommendation: "compilerOptions.declarationMap is set to true, but compilerOptions.declaration is false or omitted. Set 'declaration: true' or prune 'declarationMap: true' to prevent dead configuration.",
    })
  }

  const clean = deadDirectives.length === 0

  return {
    clean,
    hasDeclarationMap,
    hasDeclaration,
    deadCount: deadDirectives.length,
    deadDirectives,
    declarationMapProof: clean ? 'TSCONFIG_DECLARATION_MAP_CONSISTENT' : 'ORPHAN_DECLARATION_MAP_DETECTED',
  }
}
