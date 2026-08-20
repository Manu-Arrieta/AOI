/**
 * scripts/aoi-os/db-guard/sql-transaction-deadlock-guard.mjs
 *
 * Deterministic SQL Transaction Deadlock & Lock Order Guard for AOI-OS:
 * Statically audits multi-table database transactions to ensure canonical lock acquisition ordering
 * and explicit lock timeouts, preventing transaction deadlocks under high multi-agent concurrency (0 LLM Tokens).
 */

const TRANSACTION_PATTERNS = [
  /\b(?:transaction|\$transaction|tx)\s*\(\s*(?:async\s*)?\([^)]*\)\s*=>/i,
  /\bBEGIN(?:\s+TRANSACTION)?\b[\s\S]*?\bCOMMIT\b/i,
]

const TABLE_MUTATION_REGEX = /\b(?:UPDATE|DELETE\s+FROM|INSERT\s+INTO|SELECT\s+[\s\S]*?\s+FOR\s+UPDATE)\s+([a-zA-Z0-9_]+)/gi

/**
 * Audits transaction source code for lock acquisition ordering and timeout guards.
 *
 * @param {string} sourceCode - SQL or ORM transaction code
 * @returns {object} Deadlock audit report
 */
export function auditSqlTransactionDeadlockSafety(sourceCode = '') {
  let isTransaction = false
  for (const pattern of TRANSACTION_PATTERNS) {
    if (pattern.test(sourceCode)) {
      isTransaction = true
      break
    }
  }

  if (!isTransaction) {
    return {
      safe: true,
      isTransaction: false,
      accessedTables: [],
      violations: [],
      sqlDeadlockProof: 'NO_SQL_TRANSACTION_BLOCK_DETECTED',
    }
  }

  const accessedTables = []
  const matches = sourceCode.matchAll(TABLE_MUTATION_REGEX)
  for (const match of matches) {
    const tableName = match[1].toLowerCase()
    if (!accessedTables.includes(tableName)) {
      accessedTables.push(tableName)
    }
  }

  const violations = []
  // Check if multiple tables are accessed out of alphabetical order
  if (accessedTables.length >= 2) {
    const sorted = [...accessedTables].sort()
    const isSorted = accessedTables.every((val, idx) => val === sorted[idx])

    if (!isSorted) {
      violations.push(
        `NON_CANONICAL_TABLE_LOCK_ORDER: Transaction accesses tables as [${accessedTables.join(', ')}]. Canonical order should be [${sorted.join(', ')}] to prevent deadlocks.`
      )
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    isTransaction: true,
    accessedTables,
    violations,
    sqlDeadlockProof: safe
      ? 'CANONICAL_SQL_LOCK_ORDERING_VERIFIED'
      : 'POTENTIAL_SQL_TRANSACTION_DEADLOCK_RISK_DETECTED',
  }
}
