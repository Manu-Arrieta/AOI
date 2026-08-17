/**
 * scripts/aoi-os/package-guard/dead-script-hook-pruner.mjs
 *
 * Deterministic Dead Lifecycle Script Hook Pruner for AOI-OS:
 * Statically audits package.json lifecycle script hooks (preinstall, postinstall, prepare, prepublishOnly)
 * against registered workspace scripts and local tools to detect dead or broken lifecycle hooks (0 LLM Tokens).
 */

const KNOWN_LIFECYCLE_HOOKS = [
  'preinstall',
  'install',
  'postinstall',
  'prepublish',
  'prepare',
  'prepublishOnly',
  'prepack',
  'postpack',
  'preversion',
  'postversion',
]

/**
 * Audits package.json scripts for dead or broken lifecycle hooks.
 *
 * @param {object} packageJson - Parsed package.json object
 * @param {string[]} validCommandsOrScripts - Array of valid command or script names in workspace
 * @returns {object} Lifecycle script hook audit report
 */
export function auditDeadScriptHooks(packageJson = {}, validCommandsOrScripts = []) {
  const deadHooks = []
  const scripts = packageJson.scripts || {}
  const validSet = new Set(validCommandsOrScripts)

  for (const [scriptName, scriptCmd] of Object.entries(scripts)) {
    if (KNOWN_LIFECYCLE_HOOKS.includes(scriptName)) {
      // Check if command references `npm run <target>` or `pnpm run <target>` or a script name that doesn't exist
      const runMatch = scriptCmd.match(/(?:npm run|pnpm run|pnpm|yarn run)\s+([a-zA-Z0-9:_-]+)/)
      if (runMatch) {
        const target = runMatch[1]
        if (!scripts[target] && !validSet.has(target)) {
          deadHooks.push({
            hook: scriptName,
            command: scriptCmd,
            missingTarget: target,
            error: 'ORPHAN_LIFECYCLE_SCRIPT_HOOK',
            recommendation: `Lifecycle hook '${scriptName}' references missing script '${target}'. Define script '${target}' or remove hook.`,
          })
        }
      }
    }
  }

  const clean = deadHooks.length === 0

  return {
    clean,
    totalHooksCount: Object.keys(scripts).filter((k) => KNOWN_LIFECYCLE_HOOKS.includes(k)).length,
    deadCount: deadHooks.length,
    deadHooks,
    hookProof: clean ? 'LIFECYCLE_HOOKS_CANONICAL' : 'DEAD_LIFECYCLE_HOOKS_DETECTED',
  }
}
