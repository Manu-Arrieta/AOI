/**
 * scripts/aoi-os/quantum-synthesis/superposition-matrix.mjs
 *
 * Deterministic Quantum Super-Position Synthesis Matrix for AOI-OS:
 * Synthesizes and evaluates multiple candidate AST code branches in memory,
 * scoring them on cyclomatic complexity, branch density, and AST safety,
 * collapsing deterministically to the optimal AST candidate (0 LLM Tokens).
 */

import { estimateTokenComplexity } from '../sandbox-runtime/token-complexity-estimator.mjs'
import { optimizeAstRepresentation } from '../ast-optimizer/ast-inliner.mjs'

/**
 * Evaluates an array of candidate AST code variants and collapses to the optimal candidate.
 *
 * @param {Array<{ id: string, name: string, code: string }>} candidates
 * @param {object} [options]
 * @returns {object} Winning candidate and super-position evaluation matrix
 */
export function evaluateSuperpositionBranches(candidates = [], options = {}) {
  if (!candidates.length) {
    throw new Error('Superposition Matrix requires at least 1 candidate code branch.')
  }

  const scoredCandidates = candidates.map((candidate) => {
    const complexity = estimateTokenComplexity(candidate.code, `${candidate.id}.ts`)
    const optimization = optimizeAstRepresentation(candidate.code)

    // Higher is better: 100 base - complexity penalty + clean code bonus
    let fitnessScore = 100
    fitnessScore -= complexity.cyclomaticComplexity * 5
    fitnessScore -= complexity.branchCount * 3
    fitnessScore += Math.round(optimization.cleanCodeScore * 0.2)

    return {
      id: candidate.id,
      name: candidate.name,
      code: candidate.code,
      cyclomaticComplexity: complexity.cyclomaticComplexity,
      branchCount: complexity.branchCount,
      estimatedTokens: complexity.estimatedTokens,
      cleanCodeScore: optimization.cleanCodeScore,
      fitnessScore: Math.max(0, fitnessScore),
    }
  })

  // Sort descending by fitnessScore
  scoredCandidates.sort((a, b) => b.fitnessScore - a.fitnessScore)
  const winner = scoredCandidates[0]

  return {
    winner,
    totalBranchesEvaluated: candidates.length,
    matrix: scoredCandidates,
    collapsedAt: new Date().toISOString(),
  }
}
