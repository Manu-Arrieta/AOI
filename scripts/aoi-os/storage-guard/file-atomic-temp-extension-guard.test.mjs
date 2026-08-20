import test from 'node:test'
import assert from 'node:assert/strict'
import { auditAtomicTempExtensionSafety } from './file-atomic-temp-extension-guard.mjs'

test('auditAtomicTempExtensionSafety approves hidden dot-prefix and .tmp extension for atomic staging', () => {
  const code = `
const tempPath = path.join(path.dirname(targetFile), \`.\${path.basename(targetFile)}.\${crypto.randomUUID()}.tmp\`);
fs.writeFileSync(tempPath, data);
fs.renameSync(tempPath, targetFile);
`
  const result = auditAtomicTempExtensionSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.hasHiddenTmpFormat, true)
  assert.equal(result.atomicTempExtensionProof, 'HIDDEN_DOT_PREFIX_TMP_EXTENSION_VERIFIED')
})

test('auditAtomicTempExtensionSafety detects visible unprotected staging filename', () => {
  const code = `
const stagingFile = '/var/data/staging-output.json';
fs.writeFileSync(stagingFile, data);
fs.renameSync(stagingFile, targetFile);
`
  const result = auditAtomicTempExtensionSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.atomicTempExtensionProof, 'EXPOSED_STAGING_FILE_INGESTION_RISK_DETECTED')
  assert.ok(result.violations.includes('ATOMIC_STAGING_FILE_MISSING_HIDDEN_DOT_PREFIX_OR_TMP_EXTENSION'))
})

test('auditAtomicTempExtensionSafety returns safe when no atomic staging operation is detected', () => {
  const code = `
const x = 100;
`
  const result = auditAtomicTempExtensionSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.atomicTempExtensionProof, 'NO_ATOMIC_STAGING_OPERATION_DETECTED')
})
