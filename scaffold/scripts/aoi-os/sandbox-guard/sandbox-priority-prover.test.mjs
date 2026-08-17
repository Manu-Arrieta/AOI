import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxPrioritySafety } from './sandbox-priority-prover.mjs'

test('proveSandboxPrioritySafety approves compute worker with nice priority', () => {
  const code = `
function launchCompilerWorker(cmd) {
  return exec(\`nice -n 10 \${cmd}\`);
}
`
  const result = proveSandboxPrioritySafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.priorityProof, 'SCHEDULING_PRIORITY_GOVERNED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxPrioritySafety detects compute worker without priority configuration', () => {
  const code = `
function launchCompilerWorker(cmd) {
  return exec(cmd);
}
`
  const result = proveSandboxPrioritySafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.priorityProof, 'SCHEDULER_STARVATION_RISK_DETECTED')
  assert.equal(result.violationsCount, 1)
})
