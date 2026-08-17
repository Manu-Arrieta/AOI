import test from 'node:test'
import assert from 'node:assert/strict'
import { auditTransactionRollbackSafety } from './transaction-rollback-guard.mjs'

test('auditTransactionRollbackSafety approves transaction with rollback in catch', () => {
  const code = `
async function transferFunds(client) {
  try {
    await client.query('BEGIN');
    await client.query('UPDATE accounts SET balance = balance - 100 WHERE id = 1');
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}
`
  const result = auditTransactionRollbackSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.transactionProof, 'TRANSACTION_LIFECYCLE_PROTECTED')
  assert.equal(result.violationsCount, 0)
})

test('auditTransactionRollbackSafety detects manual BEGIN missing rollback', () => {
  const code = `
async function transferFunds(client) {
  await client.query('BEGIN');
  await client.query('UPDATE accounts SET balance = balance - 100 WHERE id = 1');
  await client.query('COMMIT');
}
`
  const result = auditTransactionRollbackSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.transactionProof, 'UNGUARDED_TRANSACTION_DETECTED')
  assert.equal(result.violationsCount, 1)
})
