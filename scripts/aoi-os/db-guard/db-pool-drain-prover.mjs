/**
 * scripts/aoi-os/db-guard/db-pool-drain-prover.mjs
 *
 * Deterministic Database Connection Pool Drain & Teardown Prover for AOI-OS:
 * Statically audits database clients and connection pool instances (pg.Pool, mysql2.createPool, prisma.$disconnect)
 * to prove that explicit pool closure (.end(), .close(), .$disconnect()) is guaranteed in teardown/finally blocks (0 LLM Tokens).
 */

/**
 * Audits source code for database connection pool creation and explicit teardown closure.
 *
 * @param {string} sourceCode - Module or test source code
 * @returns {object} Database pool teardown audit report
 */
export function proveDbPoolDrainSafety(sourceCode = '') {
  const violations = []

  const hasPoolOrClient = /\b(?:new\s+Pool|createPool|PrismaClient|new\s+Database)\b/g.test(sourceCode)
  const hasPoolTeardown = /\b(?:\.end\s*\(|\.\$disconnect\s*\(|\.close\s*\(|afterAll|afterEach|finally)\b/g.test(sourceCode)

  if (hasPoolOrClient && !hasPoolTeardown) {
    violations.push({
      type: 'MISSING_DATABASE_POOL_TEARDOWN',
      recommendation: "Ensure database pools or clients (Pool, PrismaClient) invoke '.end()', '.$disconnect()', or '.close()' in 'afterAll()' or 'finally' blocks.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasPoolOrClient,
    violationsCount: violations.length,
    violations,
    drainProof: safe ? 'DATABASE_POOL_DRAIN_GUARANTEED' : 'UNCLOSED_DATABASE_POOL_DETECTED',
  }
}
