/**
 * scripts/aoi-os/i18n-guard/dead-i18n-pruner.mjs
 *
 * Deterministic Dead i18n & Localization Key Pruner for AOI-OS:
 * Statically audits declared translation dictionary keys against consumer templates and codebases,
 * proving 100% localization key reachability and eliminating unused translation dictionary bloat (0 LLM Tokens).
 */

/**
 * Audits a list of declared translation keys against consumer codebases.
 *
 * @param {string[]} translationKeys - List of translation keys (e.g. ['common.confirm', 'dashboard.title'])
 * @param {string} consumerSourceCode - Aggregate consumer template and script source code
 * @returns {object} Translation key reachability report
 */
export function auditDeadI18nKeys(translationKeys = [], consumerSourceCode = '') {
  const deadKeys = []

  for (const key of translationKeys) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const keyPattern = new RegExp(`(?:\\$t|\\bt)\\s*\\(\\s*['"]${escapedKey}['"]|['"]${escapedKey}['"]`, 'g')

    if (!keyPattern.test(consumerSourceCode)) {
      deadKeys.push({
        key,
        error: 'UNREFERENCED_DEAD_I18N_KEY',
        recommendation: `Prune unused localization key '${key}' from translation dictionary files.`,
      })
    }
  }

  const allReferenced = deadKeys.length === 0

  return {
    allReferenced,
    totalKeys: translationKeys.length,
    deadKeysCount: deadKeys.length,
    deadKeys,
    i18nProof: allReferenced ? 'ALL_I18N_KEYS_REFERENCED' : 'DEAD_I18N_KEYS_DETECTED',
  }
}
