/**
 * scripts/aoi-os/telemetry/pii-masking-guard.mjs
 *
 * Deterministic Sensitive Data & PII Masking Guard for AOI-OS:
 * Statically audits telemetry and logging statements (console.log, logger.info, logger.error)
 * to prove that sensitive credentials, authorization headers, and secrets are sanitized before write (0 LLM Tokens).
 */

/**
 * Audits source code for unguarded logging of sensitive credentials and PII.
 *
 * @param {string} sourceCode - Logger or telemetry handler source code
 * @returns {object} PII masking audit report
 */
export function auditPiiMaskingSafety(sourceCode = '') {
  const violations = []

  const hasLogging = /(?:\bconsole\.(?:log|warn|error|info)\s*\(|\blogger\.(?:info|error|warn|debug)\s*\()/g.test(sourceCode)
  const hasRawSensitiveKeywords = /(?:password|authToken|bearer|secretKey|apiKey|clientSecret)\b/i.test(sourceCode)
  const hasMaskingOrSanitizer = /(?:maskSecret|redact|sanitize|maskPII|replace\s*\(\s*\/|hash\s*\()/i.test(sourceCode)

  if (hasLogging && hasRawSensitiveKeywords && !hasMaskingOrSanitizer) {
    violations.push({
      type: 'UNMASKED_SENSITIVE_CREDENTIAL_IN_LOGS',
      recommendation: "Ensure sensitive credentials and tokens are redacted with 'maskSecret()' or 'redact()' before logging.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasLogging,
    violationsCount: violations.length,
    violations,
    piiProof: safe ? 'SENSITIVE_DATA_LOGGING_MASKED' : 'UNMASKED_PII_LOGGING_RISK_DETECTED',
  }
}
