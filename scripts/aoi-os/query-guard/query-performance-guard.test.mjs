import test from 'node:test'
import assert from 'node:assert/strict'
import { auditQueryPerformance } from './query-performance-guard.mjs'

test('auditQueryPerformance approves optimal batched queries', () => {
  const safeCode = `
export async function getUsers(ids: string[]) {
  return await db.users.findMany({ where: { id: { in: ids } } });
}
`
  const result = auditQueryPerformance(safeCode, ['id'])
  assert.equal(result.optimal, true)
  assert.equal(result.performanceProof, 'OPTIMAL_QUERY_PATTERNS_PROVEN')
  assert.equal(result.issuesCount, 0)
})

test('auditQueryPerformance detects N+1 queries in loops and unindexed filters', () => {
  const badCode = `
for (const id of userIds) {
  const user = await db.user.findUnique({ where: { id } });
}
const raw = "SELECT * FROM orders WHERE status = 'PENDING'";
`
  const result = auditQueryPerformance(badCode, ['id'])
  assert.equal(result.optimal, false)
  assert.equal(result.performanceProof, 'QUERY_PERFORMANCE_ISSUES_DETECTED')
  assert.equal(result.issuesCount, 2)
  assert.ok(result.issues.some((i) => i.type === 'N_PLUS_ONE_QUERY_DETECTED'))
  assert.ok(result.issues.some((i) => i.type === 'UNINDEXED_FILTER_COLUMN'))
})
