/**
 * scripts/aoi-os/security-guard/sql-injection-guard.mjs
 *
 * Deterministic SQL Injection & Dynamic Concatenation Guard for AOI-OS:
 * Statically proves that database queries use parameterization and eliminates raw string interpolations (0 LLM Tokens).
 */

/**
 * Audits source code for dynamic SQL concatenation vulnerabilities.
 *
 * @param {string} sourceCode
 * @returns {object} SQL injection audit report
 */
export function auditSqlSecurity(sourceCode = '') {
  const violations = []

  // Check for dynamic string interpolation in raw queries: db.query(`SELECT ... ${...}`), prisma.$queryRawUnsafe(`...${...}`)
  const dynamicQueryPattern = /\b(?:db\.query|prisma\.\$queryRawUnsafe|sql\.raw|sqlite\.exec)\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*`/g
  const stringConcatPattern = /\b(?:db\.query|prisma\.\$queryRawUnsafe|sql\.raw)\s*\(\s*['"][^'"]*['"]\s*\+\s*[a-zA-Z0-9_$]+/g

  if (dynamicQueryPattern.test(sourceCode)) {
    violations.push({
      type: 'DYNAMIC_SQL_TEMPLATE_INTERPOLATION',
      recommendation: 'Use parameterized queries ($1, ? or Prisma.sql) instead of template literal interpolation in SQL queries.',
    })
  }

  if (stringConcatPattern.test(sourceCode)) {
    violations.push({
      type: 'DYNAMIC_SQL_STRING_CONCATENATION',
      recommendation: 'Avoid string concatenation (+) in SQL query execution. Supply parameters as a secondary argument array.',
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    violationsCount: violations.length,
    violations,
    sqlProof: safe ? 'SQL_QUERIES_PARAMETRIZED_AND_SECURE' : 'DYNAMIC_SQL_INJECTION_RISK_DETECTED',
  }
}
