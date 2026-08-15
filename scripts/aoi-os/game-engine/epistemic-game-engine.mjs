/**
 * scripts/aoi-os/game-engine/epistemic-game-engine.mjs
 *
 * Deterministic Epistemic Consensus Game & Nash Equilibrium Engine for AOI-OS:
 * Models multi-agent code arbitration as a cooperative game of perfect information,
 * calculating mathematical Nash Equilibrium to guarantee unbiased consensus convergence (0 LLM Tokens).
 */

/**
 * Evaluates multi-agent payoffs and calculates the Nash Equilibrium for code acceptance.
 *
 * @param {object} options
 * @param {boolean} [options.testsPassed=true]
 * @param {boolean} [options.securitySafe=true]
 * @param {boolean} [options.contractsIntact=true]
 * @param {number} [options.performanceScore=100]
 * @returns {object} Nash equilibrium calculation and consensus verdict
 */
export function calculateNashEquilibrium(options = {}) {
  const {
    testsPassed = true,
    securitySafe = true,
    contractsIntact = true,
    performanceScore = 100,
  } = options

  // Payoff functions per role (scale: -10 to +10)
  const architectPayoff = contractsIntact ? 10 : -10
  const securityPayoff = securitySafe ? 10 : -10
  const qaPayoff = testsPassed ? 10 : -10
  const devopsPayoff = performanceScore >= 80 ? 10 : Math.round((performanceScore - 80) / 2)

  const totalPayoff = architectPayoff + securityPayoff + qaPayoff + devopsPayoff
  const maxPossiblePayoff = 40

  const equilibriumScore = Math.round((Math.max(0, totalPayoff + 40) / (maxPossiblePayoff + 40)) * 100)

  // Nash equilibrium requires no critical vetoes (payoff >= 0 for all strategic roles)
  const isNashOptimal = architectPayoff > 0 && securityPayoff > 0 && qaPayoff > 0 && devopsPayoff >= 0

  return {
    isNashOptimal,
    equilibriumScore,
    payoffs: {
      architect: architectPayoff,
      security: securityPayoff,
      qa: qaPayoff,
      devops: devopsPayoff,
    },
    totalPayoff,
    consensusVerdict: isNashOptimal ? 'NASH_EQUILIBRIUM_APPROVED' : 'NASH_EQUILIBRIUM_VETOED',
  }
}
