/**
 * scripts/aoi-os/mutation-testing/ast-mutation-verifier.mjs
 *
 * Deterministic AST Mutation Testing Engine for AOI-OS:
 * Introduces synthetic micro-mutations into code to verify test suite quality
 * and ensure tests catch regressions, with 0 LLM token waste.
 */

export const MUTATION_OPERATORS = [
  { name: 'equality_inversion', from: /===/g, to: '!==' },
  { name: 'inequality_inversion', from: /!==/g, to: '===' },
  { name: 'greater_to_less_equal', from: />(?!=)/g, to: '<=' },
  { name: 'less_to_greater_equal', from: /<(?!=)/g, to: '>=' },
  { name: 'and_to_or', from: /&&/g, to: '||' },
  { name: 'or_to_and', from: /\|\|/g, to: '&&' },
  { name: 'boolean_true_to_false', from: /\breturn\s+true\b/g, to: 'return false' },
  { name: 'boolean_false_to_true', from: /\breturn\s+false\b/g, to: 'return true' },
  { name: 'increment_to_decrement', from: /\+\+/g, to: '--' },
]

/**
 * Generates mutated variants of a source code block.
 *
 * @param {string} sourceCode
 * @param {object} [options]
 * @param {number} [options.maxMutants=5]
 * @returns {Array<{ mutantId: string, operator: string, mutatedCode: string, diffLine: string }>}
 */
export function generateAstMutants(sourceCode = '', options = {}) {
  const { maxMutants = 5 } = options
  if (!sourceCode || typeof sourceCode !== 'string') return []

  const mutants = []
  let mutantCounter = 0

  for (const op of MUTATION_OPERATORS) {
    if (mutantCounter >= maxMutants) break

    if (op.from.test(sourceCode)) {
      // Reset regex index
      op.from.lastIndex = 0
      const mutated = sourceCode.replace(op.from, op.to)

      if (mutated !== sourceCode) {
        mutantCounter++
        mutants.push({
          mutantId: `mutant-${mutantCounter}-${op.name}`,
          operator: op.name,
          mutatedCode: mutated,
          diffLine: `Replaced [${op.from.source}] with [${op.to}]`,
        })
      }
    }
  }

  return mutants
}

/**
 * Evaluates mutation test coverage score.
 *
 * @param {number} totalMutants
 * @param {number} killedMutants - Number of mutants that caused test suite to fail
 * @returns {{ scorePercent: number, passed: boolean, rating: 'weak' | 'moderate' | 'strong' }}
 */
export function calculateMutationScore(totalMutants, killedMutants) {
  if (totalMutants === 0) {
    return { scorePercent: 100, passed: true, rating: 'strong' }
  }

  const scorePercent = Math.round((killedMutants / totalMutants) * 100)
  const passed = scorePercent >= 80

  let rating = 'weak'
  if (scorePercent >= 90) rating = 'strong'
  else if (scorePercent >= 70) rating = 'moderate'

  return {
    scorePercent,
    passed,
    rating,
  }
}
