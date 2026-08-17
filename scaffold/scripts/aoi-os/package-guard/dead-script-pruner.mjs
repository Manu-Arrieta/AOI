/**
 * scripts/aoi-os/package-guard/dead-script-pruner.mjs
 *
 * Deterministic Dead Script & npm Run Command Pruner for AOI-OS:
 * Statically audits script names declared in package.json against CI workflows, shell scripts,
 * and monorepo documentation to prove 100% script reachability and prune zombie commands (0 LLM Tokens).
 */

/**
 * Audits a list of declared package.json script names against workflow/codebase sources.
 *
 * @param {string[]} declaredScripts - List of script names (e.g. ['test:parity', 'build:dashboard'])
 * @param {string} consumerCodebase - Aggregate CI workflow, shell script, and markdown source code
 * @returns {object} Script reachability report
 */
export function auditDeadPackageScripts(declaredScripts = [], consumerCodebase = '') {
  const deadScripts = []

  for (const script of declaredScripts) {
    const escapedScript = script.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const scriptPattern = new RegExp(`(?:run\\s+${escapedScript}\\b|pnpm\\s+${escapedScript}\\b|npm\\s+run\\s+${escapedScript}\\b|--filter\\s+[^\\s]+\\s+${escapedScript}\\b|\\b${escapedScript}\\b)`, 'g')

    if (!scriptPattern.test(consumerCodebase)) {
      deadScripts.push({
        scriptName: script,
        error: 'UNREFERENCED_DEAD_PACKAGE_SCRIPT',
        recommendation: `Prune unused script '${script}' from package.json manifest.`,
      })
    }
  }

  const allReferenced = deadScripts.length === 0

  return {
    allReferenced,
    totalScripts: declaredScripts.length,
    deadScriptsCount: deadScripts.length,
    deadScripts,
    scriptProof: allReferenced ? 'ALL_PACKAGE_SCRIPTS_REFERENCED' : 'DEAD_PACKAGE_SCRIPTS_DETECTED',
  }
}
