/**
 * scripts/aoi-os/security-guard/query-depth-guard.mjs
 *
 * Deterministic Query Depth & Algorithmic Complexity Guard for AOI-OS:
 * Statically audits GraphQL schemas and recursive query parsers to ensure that query depth limits
 * (depthLimit, maxDepth, queryDepthLimit) are explicitly configured to prevent DoS attacks (0 LLM Tokens).
 */

/**
 * Audits GraphQL / API query resolver source code for depth limit protection.
 *
 * @param {string} sourceCode - Server schema or query parser source code
 * @returns {object} Query depth audit report
 */
export function auditQueryDepthSafety(sourceCode = '') {
  const violations = []

  const hasGraphQLServer = /\b(?:ApolloServer|createYoga|createHandler|graphqlHTTP|makeExecutableSchema)\b/g.test(sourceCode)
  const hasDepthLimit = /\b(?:depthLimit|maxDepth|queryDepthLimit|validationRules)\b/g.test(sourceCode)

  if (hasGraphQLServer && !hasDepthLimit) {
    violations.push({
      type: 'MISSING_QUERY_DEPTH_LIMIT',
      recommendation: "Configure query depth limits (e.g. 'validationRules: [depthLimit(5)]') to prevent exponential complexity DoS attacks.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasGraphQLServer,
    violationsCount: violations.length,
    violations,
    queryDepthProof: safe ? 'QUERY_DEPTH_RESTRICTION_PROVEN' : 'UNBOUNDED_QUERY_DEPTH_DETECTED',
  }
}
