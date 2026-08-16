import test from 'node:test'
import assert from 'node:assert/strict'
import { auditSqlSecurity } from './sql-injection-guard.mjs'

test('auditSqlSecurity approves parameterized queries', () => {
  const code = `
export async function getTask(id) {
  return await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
}
`
  const result = auditSqlSecurity(code)
  assert.equal(result.safe, true)
  assert.equal(result.sqlProof, 'SQL_QUERIES_PARAMETRIZED_AND_SECURE')
  assert.equal(result.violationsCount, 0)
})

test('auditSqlSecurity detects dynamic template literal interpolations in SQL queries', () => {
  const code = `
export async function getTask(id) {
  return await db.query(\`SELECT * FROM tasks WHERE id = '\${id}'\`);
}
`
  const result = auditSqlSecurity(code)
  assert.equal(result.safe, false)
  assert.equal(result.sqlProof, 'DYNAMIC_SQL_INJECTION_RISK_DETECTED')
  assert.equal(result.violationsCount, 1)
  assert.equal(result.violations[0].type, 'DYNAMIC_SQL_TEMPLATE_INTERPOLATION')
})
