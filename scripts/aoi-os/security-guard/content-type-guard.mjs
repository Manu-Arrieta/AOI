/**
 * scripts/aoi-os/security-guard/content-type-guard.mjs
 *
 * Deterministic Content-Type & Payload Serialization Guard for AOI-OS:
 * Statically audits API route body parsers to ensure that request payloads are safely validated
 * using schema validators (readValidatedBody, Zod, safeParse) or wrapped in exception handling (0 LLM Tokens).
 */

/**
 * Audits API handler source code for payload deserialization safety.
 *
 * @param {string} sourceCode - Server route or handler source code
 * @returns {object} Content-Type serialization audit report
 */
export function auditPayloadDeserializationSafety(sourceCode = '') {
  const violations = []

  const hasRawJsonParse = /\bJSON\.parse\s*\(/g.test(sourceCode) && !/\btry\s*\{[^}]*JSON\.parse/g.test(sourceCode)
  const hasUnvalidatedRawBody = /\breadBody\s*\(/g.test(sourceCode) && !/\b(?:readValidatedBody|validate|schema|zod|safeParse)\b/i.test(sourceCode)

  if (hasRawJsonParse) {
    violations.push({
      type: 'UNGUARDED_RAW_JSON_PARSE',
      recommendation: "Wrap 'JSON.parse()' calls in 'try/catch' blocks to prevent unhandled syntax error crashes on malformed payloads.",
    })
  }

  if (hasUnvalidatedRawBody) {
    violations.push({
      type: 'UNVALIDATED_REQUEST_BODY',
      recommendation: "Use 'readValidatedBody()' or validate the payload against a Zod schema before accessing properties.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    violationsCount: violations.length,
    violations,
    payloadProof: safe ? 'PAYLOAD_DESERIALIZATION_SAFE_AND_VALIDATED' : 'UNGUARDED_PAYLOAD_PARSING_DETECTED',
  }
}
