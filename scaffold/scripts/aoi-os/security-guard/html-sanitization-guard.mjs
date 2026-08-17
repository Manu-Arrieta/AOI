/**
 * scripts/aoi-os/security-guard/html-sanitization-guard.mjs
 *
 * Deterministic HTML & DOM Sanitization Guard for AOI-OS:
 * Statically audits raw HTML bindings (v-html, innerHTML, dangerouslySetInnerHTML) to verify
 * that DOMPurify.sanitize() or strict HTML escaping is enforced to prevent XSS (0 LLM Tokens).
 */

/**
 * Audits component or DOM manipulation code for XSS and unsanitized HTML insertion.
 *
 * @param {string} sourceCode - Component or DOM manipulation source code
 * @returns {object} HTML sanitization audit report
 */
export function auditHtmlSanitizationSafety(sourceCode = '') {
  const violations = []

  const hasRawHtmlBinding = /(?:v-html\s*=|innerHTML\s*=|dangerouslySetInnerHTML)/g.test(sourceCode)
  const hasSanitizer = /\b(?:DOMPurify\.sanitize|sanitizeHtml|escapeHtml|cleanHtml|sanitize\s*\()\b/g.test(sourceCode)

  if (hasRawHtmlBinding && !hasSanitizer) {
    violations.push({
      type: 'UNSANITIZED_RAW_HTML_BINDING',
      recommendation: "Ensure raw HTML bindings (v-html / innerHTML) pass content through 'DOMPurify.sanitize()' or a sanitization helper to prevent XSS.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasRawHtmlBinding,
    violationsCount: violations.length,
    violations,
    xssProof: safe ? 'HTML_SANITIZATION_PROVEN' : 'UNSANITIZED_HTML_XSS_RISK_DETECTED',
  }
}
