import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSubprocessDrainSafety } from './subprocess-drain-prover.mjs'

test('proveSubprocessDrainSafety approves spawned process with stdout/stderr stream handlers', () => {
  const code = `
const child = spawn('node', ['script.js']);
child.stdout.on('data', (d) => console.log(d));
child.stderr.on('data', (e) => console.error(e));
`
  const result = proveSubprocessDrainSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.drainProof, 'SUBPROCESS_PIPES_DRAINED_AND_BOUNDED')
  assert.equal(result.violationsCount, 0)
})

test('proveSubprocessDrainSafety detects unhandled subprocess streams with deadlock risk', () => {
  const code = `
const child = spawn('node', ['script.js']);
`
  const result = proveSubprocessDrainSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.drainProof, 'SUBPROCESS_PIPE_DEADLOCK_RISK_DETECTED')
  assert.equal(result.violationsCount, 1)
})
