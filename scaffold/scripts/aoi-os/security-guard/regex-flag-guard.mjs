/**
 * scripts/aoi-os/security-guard/regex-flag-guard.mjs
 *
 * Deterministic Safe Regular Expression Unicode Flag (u / v) Guard for AOI-OS:
 * Statically audits regular expression declarations for user input and identifier validation
 * to ensure that Unicode flags ('u' or 'v') are enforced against multi-byte surrogate pair bypasses (0 LLM Tokens).
 */

/**
 * Audits source code for RegExp declarations missing Unicode safety flags.
 *
 * @param {string} sourceCode - Validation or parser source code
 * @returns {object} Regex flag safety report
 */
export function auditRegexUnicodeSafety(sourceCode = '') {
  const violations = []

  // Match standard JavaScript regex literals: /pattern/flags
  const regexLiteralMatches = sourceCode.matchAll(/\/(?:\\\/|[^\/\n])+\/(?:[a-z]*)/g)

  for (const match of regexLiteralMatches) {
    const fullLiteral = match[0]
    // Filter out comments like // or /*
    if (fullLiteral.startsWith('//') || fullLiteral.startsWith('/*')) {
      continue
    }

    const lastSlashIdx = fullLiteral.lastIndexOf('/')
    if (lastSlashIdx <= 0) continue

    const flags = fullLiteral.slice(lastSlashIdx + 1)
    const pattern = fullLiteral.slice(1, lastSlashIdx)

    if (!flags.includes('u') && !flags.includes('v') && (pattern.includes('\\u') || pattern.includes('\\p') || pattern.includes('\\P') || /[\u0080-\uffff]/.test(pattern))) {
      violations.push({
        type: 'REGEX_MISSING_UNICODE_FLAG',
        matched: fullLiteral,
        recommendation: "Append 'u' or 'v' flag to regular expression literal to ensure multibyte Unicode correctness.",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    violationsCount: violations.length,
    violations,
    unicodeProof: safe ? 'UNICODE_REGEX_SAFETY_ENFORCED' : 'NON_UNICODE_REGEX_RISK_DETECTED',
  }
}
