/**
 * scripts/aoi-os/security-guard/regex-timeout-guard.mjs
 *
 * Deterministic Dynamic RegExp Length & ReDoS Timeout Guard for AOI-OS:
 * Statically audits dynamic RegExp instantiations (new RegExp(variable)) to verify that
 * length bounding, escaping, or execution timeouts are enforced (0 LLM Tokens).
 */

/**
 * Audits source code for safe dynamic RegExp usage.
 *
 * @param {string} sourceCode - Module or service source code
 * @returns {object} Dynamic RegExp safety report
 */
export function auditDynamicRegexSafety(sourceCode = '') {
  const violations = []

  const hasDynamicRegExp = /\bnew\s+RegExp\s*\(\s*[a-zA-Z_$][\w$]*\b/g.test(sourceCode)
  const hasGuard = /(?:\.length\s*[<>]=?|\.slice\s*\(|\.substring\s*\(|escapeRegExp|replace\s*\(\s*\/\[|\btimeout\b)/g.test(sourceCode)

  if (hasDynamicRegExp && !hasGuard) {
    violations.push({
      type: 'UNBOUNDED_DYNAMIC_REGEXP_INSTANTIATION',
      recommendation: "Ensure dynamic 'new RegExp(pattern)' instances bound input length or escape special characters to prevent ReDoS.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasDynamicRegExp,
    violationsCount: violations.length,
    violations,
    regexProof: safe ? 'DYNAMIC_REGEXP_LENGTH_BOUNDED' : 'UNBOUNDED_DYNAMIC_REGEXP_DETECTED',
  }
}
