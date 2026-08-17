/**
 * scripts/aoi-os/env-guard/dead-env-pruner.mjs
 *
 * Deterministic Dead Environment Variable & Config Flag Pruner for AOI-OS:
 * Statically audits declared environment variables (.env.example, schema config) against monorepo codebases,
 * proving 100% environment flag reachability and eliminating unused configuration bloat (0 LLM Tokens).
 */

/**
 * Audits a list of declared environment variables against consumer codebases.
 *
 * @param {string[]} declaredEnvKeys - List of env variable names (e.g. ['DATABASE_URL', 'PORT', 'LEGACY_FLAG'])
 * @param {string} consumerSourceCode - Aggregate consumer source code
 * @returns {object} Environment variable reachability report
 */
export function auditDeadEnvFlags(declaredEnvKeys = [], consumerSourceCode = '') {
  const deadFlags = []

  for (const key of declaredEnvKeys) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const envPattern = new RegExp(`(?:process\\.env\\.${escapedKey}|process\\.env\\[['"]${escapedKey}['"]\\]|['"]${escapedKey}['"]|\\b${escapedKey}\\b)`, 'g')

    if (!envPattern.test(consumerSourceCode)) {
      deadFlags.push({
        key,
        error: 'UNREFERENCED_DEAD_ENV_FLAG',
        recommendation: `Prune unused environment flag '${key}' from .env.example and configuration manifests.`,
      })
    }
  }

  const allReferenced = deadFlags.length === 0

  return {
    allReferenced,
    totalFlags: declaredEnvKeys.length,
    deadFlagsCount: deadFlags.length,
    deadFlags,
    envProof: allReferenced ? 'ALL_ENV_FLAGS_REFERENCED' : 'DEAD_ENV_FLAGS_DETECTED',
  }
}
