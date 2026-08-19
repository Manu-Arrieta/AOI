import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxProcessCoreDumpFilterSafety } from './sandbox-process-posix-core-dump-filter-prover.mjs'

test('proveSandboxProcessCoreDumpFilterSafety approves sandbox spawn with ulimit -c 0 and dumpable: false', () => {
  const code = `
function spawnSandbox(scriptPath, args) {
  const child = spawn('sh', ['-c', 'ulimit -c 0 && node ' + scriptPath], {
    dumpable: false,
  });
  return child;
}
`
  const result = proveSandboxProcessCoreDumpFilterSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.hasCoreDumpSuppression, true)
  assert.equal(result.coreDumpFilterProof, 'SANDBOX_CORE_DUMP_FILTER_SUPPRESSION_VERIFIED')
})

test('proveSandboxProcessCoreDumpFilterSafety detects sandbox spawn missing core dump suppression', () => {
  const code = `
function spawnSandbox(scriptPath, args) {
  const child = spawn('node', [scriptPath]);
  return child;
}
`
  const result = proveSandboxProcessCoreDumpFilterSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.coreDumpFilterProof, 'SANDBOX_MEMORY_CORE_DUMP_LEAK_RISK_DETECTED')
  assert.ok(result.violations.includes('SANDBOX_SPAWN_MISSING_EXPLICIT_CORE_DUMP_SUPPRESSION_LIMIT'))
})

test('proveSandboxProcessCoreDumpFilterSafety returns safe when no sandbox spawn operation is present', () => {
  const code = `
const greeting = 'hello sandbox';
`
  const result = proveSandboxProcessCoreDumpFilterSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.coreDumpFilterProof, 'NO_SANDBOX_SPAWN_OPERATION_DETECTED')
})
