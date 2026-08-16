import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSignalTeardown } from './signal-teardown-prover.mjs'

test('proveSignalTeardown approves server with signal handlers', () => {
  const code = `
const server = app.listen(3000);
process.on('SIGINT', () => {
  server.close();
});
`
  const result = proveSignalTeardown(code)
  assert.equal(result.safe, true)
  assert.equal(result.signalProof, 'GRACEFUL_SIGNAL_TEARDOWN_PROVEN')
  assert.equal(result.violationsCount, 0)
})

test('proveSignalTeardown detects long-running server without signal handlers', () => {
  const code = `
const server = app.listen(3000);
`
  const result = proveSignalTeardown(code)
  assert.equal(result.safe, false)
  assert.equal(result.signalProof, 'UNHANDLED_SIGNAL_TERMINATION_RISK')
  assert.equal(result.violationsCount, 1)
})
