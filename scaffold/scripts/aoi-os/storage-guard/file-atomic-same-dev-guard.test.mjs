import test from 'node:test'
import assert from 'node:assert/strict'
import { auditAtomicSameDevSafety } from './file-atomic-same-dev-guard.mjs'

test('auditAtomicSameDevSafety approves co-located staging file path in target dirname', () => {
  const code = `
const tempPath = path.join(path.dirname(targetFile), \`.\${path.basename(targetFile)}.\${crypto.randomUUID()}.tmp\`);
fs.writeFileSync(tempPath, data);
fs.renameSync(tempPath, targetFile);
`
  const result = auditAtomicSameDevSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.hasSameDevPlacement, true)
  assert.equal(result.sameDevProof, 'SAME_DEVICE_STAGING_PLACEMENT_VERIFIED')
})

test('auditAtomicSameDevSafety detects unsafe cross-device temp file rename from /tmp to target', () => {
  const code = `
const tempFile = '/tmp/staging-file.tmp';
fs.writeFileSync(tempFile, data);
fs.renameSync(tempFile, targetFile);
`
  const result = auditAtomicSameDevSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.sameDevProof, 'CROSS_DEVICE_EXDEV_RENAME_RISK_DETECTED')
  assert.ok(result.violations.includes('ATOMIC_RENAME_MISSING_SAME_DIRECTORY_OR_SAME_DEV_PLACEMENT'))
})

test('auditAtomicSameDevSafety returns safe when no rename operation is present', () => {
  const code = `
const a = 123;
`
  const result = auditAtomicSameDevSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.sameDevProof, 'NO_ATOMIC_RENAME_OPERATION_DETECTED')
})
