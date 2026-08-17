import test from 'node:test'
import assert from 'node:assert/strict'
import { auditFileWatcherBigIntSafety } from './file-watcher-bigint-guard.mjs'

test('auditFileWatcherBigIntSafety approves fs.stat with bigint: true and mtimeNs comparison', () => {
  const code = `
async function checkChanged(file, lastMtimeNs) {
  const stats = await fs.promises.stat(file, { bigint: true });
  if (stats.mtimeNs > lastMtimeNs) {
    return true;
  }
  return false;
}
`
  const result = auditFileWatcherBigIntSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.watcherBigIntProof, 'STAT_TIMESTAMP_BIGINT_PRECISION_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditFileWatcherBigIntSafety detects float timestamp comparison in fs.stat', () => {
  const code = `
function isModified(filePath, previousTime) {
  const s = fs.statSync(filePath);
  return s.mtimeMs > previousTime;
}
`
  const result = auditFileWatcherBigIntSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.watcherBigIntProof, 'FLOAT_TIMESTAMP_PRECISION_LOSS_RISK')
  assert.equal(result.violationsCount, 1)
})
