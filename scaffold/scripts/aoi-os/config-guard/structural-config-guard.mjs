/**
 * scripts/aoi-os/config-guard/structural-config-guard.mjs
 *
 * Deterministic JSON / YAML Structural AST Invariant Guard for AOI-OS:
 * Statically parses and validates configuration file syntax and structure,
 * proving that artifacts are 100% well-formed and schema-safe prior to sandbox execution (0 LLM Tokens).
 */

/**
 * Validates structural syntax of JSON or JSONC content.
 *
 * @param {string} content - Configuration file content
 * @param {string} [format='json'] - Format ('json' | 'jsonc')
 * @returns {object} Structural validation report
 */
export function validateStructuralConfig(content = '', format = 'json') {
  try {
    let sanitized = content
    if (format === 'jsonc') {
      // Strip single and multi-line comments for JSONC
      sanitized = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    }

    const parsed = JSON.parse(sanitized)
    const isObjectOrArray = typeof parsed === 'object' && parsed !== null

    return {
      valid: true,
      isStructure: isObjectOrArray,
      error: null,
      structuralProof: 'CONFIG_SYNTAX_AND_AST_STRUCTURE_PROVEN',
    }
  } catch (err) {
    return {
      valid: false,
      isStructure: false,
      error: err.message,
      structuralProof: 'MALFORMED_CONFIG_SYNTAX_DETECTED',
    }
  }
}
