/**
 * scripts/aoi-os/config-guard/dead-tsconfig-jsx-pruner.mjs
 *
 * Deterministic Dead TypeScript JSX Configuration Pruner for AOI-OS:
 * Statically audits compilerOptions.jsx / jsxImportSource in tsconfig.json against workspace source files
 * to prune obsolete JSX compilation directives in non-JSX / pure backend / pure Vue SFC projects,
 * reducing tsc AST parse overhead and preventing JSX type conflicts (0 LLM Tokens).
 */

/**
 * Audits tsconfig.json compilerOptions for dead or unneeded JSX settings.
 *
 * @param {object} tsconfigJson - Parsed tsconfig.json object
 * @param {string[]} existingFilePaths - Array of existing workspace file relative paths
 * @returns {object} TS JSX configuration audit report
 */
export function auditDeadTsconfigJsx(tsconfigJson = {}, existingFilePaths = []) {
  const deadSettings = []
  const compilerOptions = tsconfigJson?.compilerOptions || {}

  const hasJsxOption = typeof compilerOptions.jsx === 'string'
  const hasJsxImportSource = typeof compilerOptions.jsxImportSource === 'string'

  if (hasJsxOption || hasJsxImportSource) {
    const hasJsxFiles = existingFilePaths.some((p) => /\.(?:jsx|tsx)$/i.test(p))

    if (!hasJsxFiles) {
      if (hasJsxOption) {
        deadSettings.push({
          option: 'jsx',
          value: compilerOptions.jsx,
          error: 'DEAD_TSCONFIG_JSX_OPTION',
          recommendation: `compilerOptions.jsx '${compilerOptions.jsx}' is declared but no .jsx/.tsx files exist in workspace. Prune to reduce tsc parser overhead.`,
        })
      }
      if (hasJsxImportSource) {
        deadSettings.push({
          option: 'jsxImportSource',
          value: compilerOptions.jsxImportSource,
          error: 'DEAD_TSCONFIG_JSX_IMPORT_SOURCE',
          recommendation: `compilerOptions.jsxImportSource '${compilerOptions.jsxImportSource}' is declared without any JSX files. Prune.`,
        })
      }
    }
  }

  const clean = deadSettings.length === 0

  return {
    clean,
    deadCount: deadSettings.length,
    deadSettings,
    jsxProof: clean ? 'TSCONFIG_JSX_CANONICAL' : 'DEAD_TSCONFIG_JSX_CONFIG_DETECTED',
  }
}
