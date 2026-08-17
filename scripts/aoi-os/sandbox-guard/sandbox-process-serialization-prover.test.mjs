import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxProcessSerializationSafety } from './sandbox-process-serialization-prover.mjs'

test('proveSandboxProcessSerializationSafety approves fork with serialization: advanced', () => {
  const code = `
const child = fork('./worker.js', [], {
  cwd: '/sandbox',
  serialization: 'advanced',
});
`
  const result = proveSandboxProcessSerializationSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.serializationProof, 'V8_ADVANCED_IPC_SERIALIZATION_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxProcessSerializationSafety detects fork missing serialization: advanced', () => {
  const code = `
const child = fork('./worker.js', [], {
  cwd: '/sandbox',
});
`
  const result = proveSandboxProcessSerializationSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.serializationProof, 'LEGACY_JSON_IPC_CRASH_RISK')
  assert.equal(result.violationsCount, 1)
})
