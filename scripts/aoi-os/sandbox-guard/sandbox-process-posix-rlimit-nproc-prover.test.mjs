import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxProcessRlimitNprocSafety } from './sandbox-process-posix-rlimit-nproc-prover.mjs'

test('proveSandboxProcessRlimitNprocSafety approves concurrent worker spawn bounded by pLimit', () => {
  const code = `
const limit = pLimit(maxProcesses);
await Promise.all(tasks.map(task => limit(() => spawn('node', [task.script]))));
`
  const result = proveSandboxProcessRlimitNprocSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.rlimitNprocProof, 'PROCESS_CONCURRENCY_NPROC_BOUND_VERIFIED')
})

test('proveSandboxProcessRlimitNprocSafety detects unbounded Promise.all map spawn loop', () => {
  const code = `
await Promise.all(tasks.map(task => spawn('node', [task.script])));
`
  const result = proveSandboxProcessRlimitNprocSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.rlimitNprocProof, 'UNBOUNDED_PROCESS_FORK_BOMB_RISK_DETECTED')
  assert.ok(result.violations.includes('CONCURRENT_PROCESS_SPAWN_MISSING_EXPLICIT_NPROC_BOUND_LIMIT'))
})

test('proveSandboxProcessRlimitNprocSafety returns safe when no concurrent spawn loop exists', () => {
  const code = `
const child = spawn('node', ['worker.mjs']);
`
  const result = proveSandboxProcessRlimitNprocSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.rlimitNprocProof, 'NO_CONCURRENT_PROCESS_SPAWN_DETECTED')
})
