import test from 'node:test'
import assert from 'node:assert/strict'
import { auditSqlTransactionDeadlockSafety } from './sql-transaction-deadlock-guard.mjs'

test('auditSqlTransactionDeadlockSafety approves canonical alphabetical table locking order', () => {
  const code = `
await db.transaction(async (tx) => {
  await tx.raw('UPDATE accounts SET balance = balance - 100 WHERE id = ?', [1]);
  await tx.raw('UPDATE orders SET status = "paid" WHERE id = ?', [42]);
  await tx.raw('UPDATE users SET last_active = NOW() WHERE id = ?', [1]);
});
`
  const result = auditSqlTransactionDeadlockSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.sqlDeadlockProof, 'CANONICAL_SQL_LOCK_ORDERING_VERIFIED')
  assert.deepEqual(result.accessedTables, ['accounts', 'orders', 'users'])
})

test('auditSqlTransactionDeadlockSafety detects inverted table access order in transaction', () => {
  const code = `
await db.transaction(async (tx) => {
  await tx.raw('UPDATE users SET last_active = NOW() WHERE id = ?', [1]);
  await tx.raw('UPDATE accounts SET balance = balance - 100 WHERE id = ?', [1]);
});
`
  const result = auditSqlTransactionDeadlockSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.sqlDeadlockProof, 'POTENTIAL_SQL_TRANSACTION_DEADLOCK_RISK_DETECTED')
  assert.ok(result.violations[0].includes('NON_CANONICAL_TABLE_LOCK_ORDER'))
})

test('auditSqlTransactionDeadlockSafety returns safe when no transaction block is present', () => {
  const code = `
const data = "read-only non-transactional code";
`
  const result = auditSqlTransactionDeadlockSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.sqlDeadlockProof, 'NO_SQL_TRANSACTION_BLOCK_DETECTED')
})
