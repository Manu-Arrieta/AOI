/**
 * scripts/aoi-os/config-guard/dead-tsconfig-baseurl-pruner.mjs
 *
 * Deterministic Dead TypeScript BaseUrl Configuration Pruner for AOI-OS:
 * Statically audits compilerOptions.baseUrl in tsconfig.json to prune redundant baseUrl: "." directives
 * when modern moduleResolution ("bundler" | "node16" | "nodenext") or self-contained paths are in use,
 * eliminating ambiguous non-relative module resolution in tsc and improving LSP indexing (0 LLM Tokens).
 */

/**
 * Audits tsconfig.json compilerOptions for redundant or dead baseUrl settings.
 *
 * @param {object} tsconfigJson - Parsed tsconfig.json object
 * @returns {object} TS baseUrl configuration audit report
 */
export function auditDeadTsconfigBaseUrl(tsconfigJson = {}) {
  const deadSettings = []
  const compilerOptions = tsconfigJson?.compilerOptions || {}

  const baseUrl = compilerOptions.baseUrl
  const moduleResolution = String(compilerOptions.moduleResolution || '').toLowerCase()
  const paths = compilerOptions.paths || {}
  const hasPaths = Object.keys(paths).length > 0

  const usesModernResolution = ['bundler', 'node16', 'nodenext'].includes(moduleResolution)

  if (baseUrl === '.' && usesModernResolution && !hasPaths) {
    deadSettings.push({
      option: 'baseUrl',
      value: baseUrl,
      error: 'REDUNDANT_TSCONFIG_BASE_URL',
      recommendation: `compilerOptions.baseUrl '.' is redundant under moduleResolution '${moduleResolution}' when no paths are declared. Prune to prevent accidental non-relative import resolution.`,
    })
  }

  const clean = deadSettings.length === 0

  return {
    clean,
    deadCount: deadSettings.length,
    deadSettings,
    baseUrlProof: clean ? 'TSCONFIG_BASE_URL_CANONICAL' : 'REDUNDANT_TSCONFIG_BASE_URL_DETECTED',
  }
}
