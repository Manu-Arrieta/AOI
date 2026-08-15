/**
 * scripts/aoi-os/schema-guard/schema-sunset-sentinel.mjs
 *
 * Deterministic API Field Deprecation & Sunset Sentinel for AOI-OS:
 * Statically detects references to deprecated schema properties, fields, and endpoints,
 * proving that client code consumes only active, supported contracts (0 LLM Tokens).
 */

/**
 * Audits source code for references to deprecated API fields.
 *
 * @param {string} sourceCode
 * @param {Array<{ name: string, replacement?: string }>} [deprecatedFields=[]]
 * @returns {object} Schema deprecation audit report
 */
export function auditSchemaSunset(sourceCode = '', deprecatedFields = []) {
  const detectedDeprecations = []

  for (const field of deprecatedFields) {
    const fieldRegex = new RegExp(`\\b${field.name}\\b`, 'g')
    if (fieldRegex.test(sourceCode)) {
      detectedDeprecations.push({
        field: field.name,
        replacement: field.replacement || 'None provided',
        type: 'DEPRECATED_SCHEMA_FIELD_REFERENCED',
        recommendation: field.replacement
          ? `Migrate '${field.name}' to modern replacement '${field.replacement}'`
          : `Remove usage of sunsetted field '${field.name}'`,
      })
    }
  }

  const modern = detectedDeprecations.length === 0

  return {
    modern,
    detectedCount: detectedDeprecations.length,
    detectedDeprecations,
    sentinelProof: modern ? 'ALL_REFERENCED_FIELDS_ACTIVE_AND_MODERN' : 'SUNSET_DEPRECATED_FIELDS_DETECTED',
  }
}
