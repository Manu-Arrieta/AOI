/**
 * scripts/aoi-os/config-guard/dead-tsconfig-interop-pruner.mjs
 *
 * Deterministic Dead TypeScript Interop Flag Pruner for AOI-OS:
 * Statically audits compilerOptions in tsconfig.json to prune redundant allowSyntheticDefaultImports
 * declarations when esModuleInterop: true is already enabled, streamlining compiler configuration
 * and avoiding duplicate flag processing (0 LLM Tokens).
 */

/**
 * Audits tsconfig.json compilerOptions for redundant ESM interop flags.
 *
 * @param {object} tsconfigJson - Parsed tsconfig.json object
 * @returns {object} TS interop flags audit report
 */
export function auditDeadTsconfigInterop(tsconfigJson = {}) {
  const deadFlags = []
  const compilerOptions = tsconfigJson?.compilerOptions || {}

  const hasEsModuleInterop = compilerOptions.esModuleInterop === true
  const hasAllowSynthetic = compilerOptions.allowSyntheticDefaultImports === true

  if (hasEsModuleInterop && hasAllowSynthetic) {
    deadFlags.push({
      option: 'allowSyntheticDefaultImports',
      value: true,
      error: 'REDUNDANT_TSCONFIG_INTEROP_FLAG',
      recommendation: "compilerOptions.allowSyntheticDefaultImports is redundant when esModuleInterop is true (esModuleInterop automatically implies allowSyntheticDefaultImports). Prune allowSyntheticDefaultImports.",
    })
  }

  const clean = deadFlags.length === 0

  return {
    clean,
    deadCount: deadFlags.length,
    deadFlags,
    interopProof: clean ? 'TSCONFIG_INTEROP_CANONICAL' : 'REDUNDANT_TSCONFIG_INTEROP_DETECTED',
  }
}
