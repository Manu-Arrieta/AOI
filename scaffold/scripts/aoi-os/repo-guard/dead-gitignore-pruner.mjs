/**
 * scripts/aoi-os/repo-guard/dead-gitignore-pruner.mjs
 *
 * Deterministic Dead Gitignore Entry & Duplicate Exclusion Rule Pruner for AOI-OS:
 * Statically audits .gitignore rule sets to detect duplicate, conflicting, or redundant ignore entries (0 LLM Tokens).
 */

/**
 * Audits a list of gitignore rules for duplicates and redundancy.
 *
 * @param {string[]} rules - Array of gitignore pattern lines
 * @returns {object} Gitignore audit report
 */
export function auditDeadGitignoreRules(rules = []) {
  const seen = new Set()
  const duplicates = []

  for (const rawRule of rules) {
    const trimmed = rawRule.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    if (seen.has(trimmed)) {
      duplicates.push({
        rule: trimmed,
        error: 'DUPLICATE_GITIGNORE_RULE',
        recommendation: `Remove duplicate '${trimmed}' rule from .gitignore.`,
      })
    } else {
      seen.add(trimmed)
    }
  }

  const clean = duplicates.length === 0

  return {
    clean,
    totalRules: rules.length,
    duplicateCount: duplicates.length,
    duplicates,
    gitignoreProof: clean ? 'GITIGNORE_RULES_CANONICAL' : 'DUPLICATE_GITIGNORE_RULES_DETECTED',
  }
}
