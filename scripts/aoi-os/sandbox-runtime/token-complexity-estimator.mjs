/**
 * scripts/aoi-os/sandbox-runtime/token-complexity-estimator.mjs
 *
 * Deterministic Predictive Token Complexity & Budget Estimator for AOI-OS:
 * Analyzes code structure, cyclomatic branches, and AST depth to predict
 * token requirements prior to LLM dispatch and suggest atomic splits.
 */

/**
 * Computes deterministic complexity metrics for source code.
 *
 * @param {string} sourceCode
 * @param {string} [filePath='file.ts']
 * @returns {object} Complexity profile and token predictions
 */
export function estimateTokenComplexity(sourceCode = '', filePath = 'file.ts') {
  if (!sourceCode || typeof sourceCode !== 'string') {
    return {
      linesOfCode: 0,
      cyclomaticComplexity: 1,
      estimatedPromptTokens: 100,
      estimatedCompletionTokens: 150,
      totalEstimatedTokens: 250,
      complexityRating: 'low',
      recommendation: 'direct',
    }
  }

  const lines = sourceCode.split('\n')
  const linesOfCode = lines.filter((l) => l.trim().length > 0).length

  // Count decision branches (cyclomatic indicators)
  const branchMatches = sourceCode.match(/\b(if|else\s+if|case|default|for|while|catch|\?\s*[^:]+:|&&|\|\|)\b/g)
  const branchCount = branchMatches ? branchMatches.length : 0
  const cyclomaticComplexity = 1 + branchCount

  // Count imports / dependencies
  const importMatches = sourceCode.match(/\b(import|require|using|from)\b/g)
  const importCount = importMatches ? importMatches.length : 0

  // Predictive token formula:
  // - Base prompt scaffolding overhead: ~300 tokens
  // - Source code character estimate: ~3.5 chars per token
  // - Estimated reasoning overhead based on cyclomatic complexity: ~60 tokens per branch
  const promptSourceTokens = Math.round(sourceCode.length / 3.5)
  const estimatedPromptTokens = 300 + promptSourceTokens
  const estimatedCompletionTokens = Math.min(
    4000,
    Math.max(200, Math.round(linesOfCode * 4.5 + cyclomaticComplexity * 60))
  )
  const totalEstimatedTokens = estimatedPromptTokens + estimatedCompletionTokens

  let complexityRating = 'low'
  if (cyclomaticComplexity > 30 || linesOfCode > 400) {
    complexityRating = 'extreme'
  } else if (cyclomaticComplexity > 15 || linesOfCode > 200) {
    complexityRating = 'high'
  } else if (cyclomaticComplexity > 6 || linesOfCode > 80) {
    complexityRating = 'medium'
  }

  const recommendation = complexityRating === 'extreme' ? 'split_atomic' : 'direct'

  return {
    filePath,
    linesOfCode,
    branchCount,
    cyclomaticComplexity,
    importCount,
    estimatedPromptTokens,
    estimatedCompletionTokens,
    totalEstimatedTokens,
    complexityRating,
    recommendation,
  }
}
