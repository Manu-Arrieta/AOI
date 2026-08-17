import test from 'node:test'
import assert from 'node:assert/strict'
import { auditUnhandledRejectionSafety } from './unhandled-rejection-guard.mjs'

test('auditUnhandledRejectionSafety approves process with unhandledRejection listener', () => {
  const code = `
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});

async function main() {
  await startDaemon();
}
`
  const result = auditUnhandledRejectionSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.rejectionProof, 'PROCESS_EXCEPTIONS_GOVERNED')
  assert.equal(result.violationsCount, 0)
})

test('auditUnhandledRejectionSafety detects async main without exception hooks or catch block', () => {
  const code = `
async function main() {
  const data = await fetchTasks();
  execute(data);
}
main();
`
  const result = auditUnhandledRejectionSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.rejectionProof, 'UNGOVERNED_UNHANDLED_REJECTIONS_RISK')
  assert.equal(result.violationsCount, 1)
})
