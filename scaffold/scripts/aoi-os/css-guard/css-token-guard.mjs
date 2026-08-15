/**
 * scripts/aoi-os/css-guard/css-token-guard.mjs
 *
 * Deterministic CSS Custom Property & Design Token Drift Guard for AOI-OS:
 * Statically audits CSS variable usage against declared design tokens,
 * proving that all UI components consume valid, defined design system variables (0 LLM Tokens).
 */

/**
 * Audits CSS/Vue source code for undeclared or drifting CSS custom properties.
 *
 * @param {string} sourceCode - Source CSS or Vue SFC template/style
 * @param {string[]} declaredTokens - List of valid CSS tokens (e.g. ['--color-primary', '--space-md'])
 * @returns {object} CSS token audit report
 */
export function auditCssTokenDrift(sourceCode = '', declaredTokens = []) {
  const matches = sourceCode.matchAll(/var\(\s*(--[a-zA-Z0-9_\-]+)\s*(?:,[^)]+)?\)/g)
  const undeclaredTokens = []

  for (const match of matches) {
    const tokenName = match[1]
    if (!declaredTokens.includes(tokenName)) {
      undeclaredTokens.push({
        token: tokenName,
        type: 'UNDECLARED_CSS_DESIGN_TOKEN',
        recommendation: `Declare '${tokenName}' in the design system or use an existing declared token.`,
      })
    }
  }

  const valid = undeclaredTokens.length === 0

  return {
    valid,
    undeclaredCount: undeclaredTokens.length,
    undeclaredTokens,
    tokenProof: valid ? 'ALL_CSS_TOKENS_DECLARED_AND_CONVERGENT' : 'UNDECLARED_CSS_TOKENS_DETECTED',
  }
}
