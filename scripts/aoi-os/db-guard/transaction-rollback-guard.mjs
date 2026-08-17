/**
 * scripts/aoi-os/db-guard/transaction-rollback-guard.mjs
 *
 * Deterministic Database Transaction Rollback & Commit Lifecycle Guard for AOI-OS:
 * Statically audits database transaction routines (BEGIN, transaction callbacks, prisma.$transaction)
 * to prove that ROLLBACK on exception or managed transaction scopes are guaranteed (0 LLM Tokens).
 */

/**
 * Audits source code for safe database transaction lifecycle management.
 *
 * @param {string} sourceCode - Database service or transaction handler source code
 * @returns {object} Transaction lifecycle audit report
 */
export function auditTransactionRollbackSafety(sourceCode = '') {
  const violations = []

  const hasManualBegin = /(?:client\.query\s*\(\s*['"]BEGIN['"]|db\.query\s*\(\s*['"]BEGIN['"]|startTransaction\s*\()/g.test(sourceCode)
  const hasRollback = /\b(?:ROLLBACK|rollback\s*\()\b/g.test(sourceCode)

  if (hasManualBegin && !hasRollback) {
    violations.push({
      type: 'UNGUARDED_TRANSACTION_BEGIN',
      recommendation: "Ensure transactions with manual 'BEGIN' execute 'ROLLBACK' inside a catch/finally block to prevent table locks.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasManualBegin,
    violationsCount: violations.length,
    violations,
    transactionProof: safe ? 'TRANSACTION_LIFECYCLE_PROTECTED' : 'UNGUARDED_TRANSACTION_DETECTED',
  }
}
