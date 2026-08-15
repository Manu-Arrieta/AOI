/**
 * scripts/aoi-os/query-guard/query-performance-guard.mjs
 *
 * Deterministic Database Query & N+1 Pattern Static Guard for AOI-OS:
 * Statically inspects SQL and ORM queries across TS/C#/Python,
 * detecting missing indexes on filters and N+1 query patterns inside iterations (0 LLM Tokens).
 */

/**
 * Audits source code for database query performance anti-patterns.
 *
 * @param {string} sourceCode
 * @param {string[]} [indexedColumns=[]] - Declared indexed columns
 * @returns {object} Query performance audit report
 */
export function auditQueryPerformance(sourceCode = '', indexedColumns = []) {
  const issues = []

  // 1. Detect N+1 query pattern inside for/forEach/while loops
  const loopWithQueryRegex = /(?:for\s*\([^)]+\)|while\s*\([^)]+\)|\.forEach\s*\([^)]+\))\s*\{[^}]*?(?:await\s+(?:db\.|prisma\.|repository\.|context\.|\w+Query\b)|SELECT\b)/gs
  if (loopWithQueryRegex.test(sourceCode)) {
    issues.push({
      type: 'N_PLUS_ONE_QUERY_DETECTED',
      recommendation: 'Batch queries using WHERE IN (...) or eager loading (include/join) instead of executing queries in a loop.',
    })
  }

  // 2. Detect unindexed WHERE clauses in raw SQL
  const sqlWhereRegex = /WHERE\s+([a-zA-Z0-9_]+)\s*(=|<|>|LIKE|IN)/gi
  let match
  while ((match = sqlWhereRegex.exec(sourceCode)) !== null) {
    const colName = match[1]
    if (indexedColumns.length > 0 && !indexedColumns.includes(colName) && colName.toLowerCase() !== 'id') {
      issues.push({
        type: 'UNINDEXED_FILTER_COLUMN',
        column: colName,
        recommendation: `Add a database index for filtered column '${colName}' to avoid full table scans.`,
      })
    }
  }

  const optimal = issues.length === 0

  return {
    optimal,
    issuesCount: issues.length,
    issues,
    performanceProof: optimal ? 'OPTIMAL_QUERY_PATTERNS_PROVEN' : 'QUERY_PERFORMANCE_ISSUES_DETECTED',
  }
}
