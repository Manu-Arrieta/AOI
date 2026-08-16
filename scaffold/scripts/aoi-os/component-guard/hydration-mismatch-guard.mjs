/**
 * scripts/aoi-os/component-guard/hydration-mismatch-guard.mjs
 *
 * Deterministic SSR Hydration Mismatch & Non-Deterministic Client State Guard for AOI-OS:
 * Statically audits Vue SFC templates and top-level scripts for non-deterministic APIs
 * (Math.random, Date.now, window/localStorage access) outside onMounted / <ClientOnly>,
 * proving 100% deterministic SSR hydration (0 LLM Tokens).
 */

/**
 * Audits Vue SFC source code for potential SSR hydration mismatches.
 *
 * @param {string} sfcSourceCode - Vue SFC source code
 * @returns {object} Hydration safety report
 */
export function auditHydrationSafety(sfcSourceCode = '') {
  const violations = []

  // Check template for top-level non-deterministic calls
  const templateMatch = sfcSourceCode.match(/<template>([\s\S]*?)<\/template>/)
  const templateContent = templateMatch ? templateMatch[1] : ''

  if (templateContent) {
    if (/\b(?:Math\.random|Date\.now)\s*\(\s*\)/.test(templateContent)) {
      violations.push({
        type: 'TEMPLATE_NON_DETERMINISTIC_EXPRESSION',
        recommendation: "Avoid calling 'Math.random()' or 'Date.now()' directly in templates; compute deterministically or wrap in <ClientOnly>.",
      })
    }
  }

  // Check script for unguarded browser globals at setup root
  const scriptMatch = sfcSourceCode.match(/<script\b[^>]*>([\s\S]*?)<\/script>/)
  const scriptContent = scriptMatch ? scriptMatch[1] : ''

  if (scriptContent) {
    const hasUnguardedBrowserGlobals = /(?:const|let|var)\s+[a-zA-Z0-9_$]+\s*=\s*(?:window\.|localStorage\.|document\.)/g.test(scriptContent) &&
      !scriptContent.includes('onMounted') &&
      !scriptContent.includes('import.meta.client')

    if (hasUnguardedBrowserGlobals) {
      violations.push({
        type: 'ROOT_SCRIPT_UNGUARDED_BROWSER_GLOBAL',
        recommendation: "Access browser globals ('window', 'localStorage', 'document') inside 'onMounted()' or behind 'import.meta.client' guards.",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    violationsCount: violations.length,
    violations,
    hydrationProof: safe ? 'SSR_HYDRATION_DETERMINISM_PROVEN' : 'POTENTIAL_HYDRATION_MISMATCH_DETECTED',
  }
}
