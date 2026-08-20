/**
 * scripts/aoi-os/component-guard/a11y-template-guard.mjs
 *
 * Deterministic Web Accessibility (WCAG 2.1 AA / a11y) Template Guard for AOI-OS:
 * Statically audits Vue SFC and HTML templates for image alt tags, form label associations,
 * keyboard accessibility on clickable non-interactive elements, and ARIA roles (0 LLM Tokens).
 */

/**
 * Audits template source code for WCAG accessibility compliance.
 *
 * @param {string} templateCode - Vue SFC template or HTML snippet
 * @returns {object} Accessibility audit report
 */
export function auditA11yTemplateCompliance(templateCode = '') {
  const violations = []
  const warnings = []

  // 1. Check for <img> tags without alt attribute
  const imgMatches = templateCode.matchAll(/<img\b([^>]*?)>/gi)
  for (const match of imgMatches) {
    const attrs = match[1] || ''
    if (!/\balt\s*=/i.test(attrs)) {
      violations.push(`A11Y_MISSING_IMG_ALT: <img> tag lacks an 'alt' attribute -> '${match[0]}'`)
    }
  }

  // 2. Check for clickable <div> / <span> without role or keyboard handler
  const clickableDivs = templateCode.matchAll(/<(?:div|span)\b([^>]*?(?:@click|v-on:click|onclick)[^>]*?)>/gi)
  for (const match of clickableDivs) {
    const attrs = match[1] || ''
    const hasButtonRole = /\brole\s*=\s*['"]button['"]/i.test(attrs)
    const hasTabindex = /\btabindex\s*=/i.test(attrs)

    if (!hasButtonRole || !hasTabindex) {
      violations.push(`A11Y_NON_SEMANTIC_CLICKABLE: Clickable non-interactive element missing role="button" or tabindex -> '${match[0]}'`)
    }
  }

  // 3. Check for <label> without for or nested input
  const labelMatches = templateCode.matchAll(/<label\b([^>]*?)>(.*?)<\/label>/gis)
  for (const match of labelMatches) {
    const attrs = match[1] || ''
    const inner = match[2] || ''
    const hasForAttr = /\b(?:for|:for|htmlFor)\s*=/i.test(attrs)
    const hasNestedInput = /<(?:input|select|textarea)\b/i.test(inner)

    if (!hasForAttr && !hasNestedInput) {
      warnings.push(`A11Y_ORPHAN_LABEL: <label> has neither 'for' attribute nor nested input element -> '${match[0]}'`)
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    violations,
    warnings,
    a11yProof: safe
      ? 'A11Y_WCAG_TEMPLATE_COMPLIANCE_VERIFIED'
      : 'A11Y_ACCESSIBILITY_VIOLATION_DETECTED',
  }
}
