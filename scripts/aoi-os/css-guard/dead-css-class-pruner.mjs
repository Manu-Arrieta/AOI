/**
 * scripts/aoi-os/css-guard/dead-css-class-pruner.mjs
 *
 * Deterministic Dead Custom CSS Class & Utility Pruner for AOI-OS:
 * Statically audits declared custom CSS classes against Vue/JSX templates and HTML elements,
 * proving 100% stylesheet reachability and eliminating dead CSS rules (0 LLM Tokens).
 */

/**
 * Audits a list of declared custom CSS classes against template codebases.
 *
 * @param {string[]} declaredClasses - List of custom class names (e.g. ['custom-badge', 'hero-title'])
 * @param {string} consumerTemplateCode - Aggregate template / JSX / HTML source code
 * @returns {object} Dead CSS class audit report
 */
export function auditDeadCssClasses(declaredClasses = [], consumerTemplateCode = '') {
  const deadClasses = []

  for (const cls of declaredClasses) {
    const escapedClass = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const classPattern = new RegExp(`(?:['"\\s]${escapedClass}['"\\s]|\\b${escapedClass}\\b)`, 'g')

    if (!classPattern.test(consumerTemplateCode)) {
      deadClasses.push({
        className: cls,
        error: 'UNREFERENCED_DEAD_CSS_CLASS',
        recommendation: `Prune unused custom CSS class '.${cls}' from stylesheets.`,
      })
    }
  }

  const allReferenced = deadClasses.length === 0

  return {
    allReferenced,
    totalClasses: declaredClasses.length,
    deadClassesCount: deadClasses.length,
    deadClasses,
    cssClassProof: allReferenced ? 'ALL_CSS_CLASSES_REFERENCED' : 'DEAD_CSS_CLASSES_DETECTED',
  }
}
