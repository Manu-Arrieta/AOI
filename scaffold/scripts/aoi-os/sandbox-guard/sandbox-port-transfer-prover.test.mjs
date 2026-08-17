import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxPortTransferSafety } from './sandbox-port-transfer-prover.mjs'

test('proveSandboxPortTransferSafety approves MessageChannel with explicit port closure', () => {
  const code = `
function establishWorkerChannel(worker) {
  const { port1, port2 } = new MessageChannel();
  worker.postMessage({ type: 'INIT' }, [port2]);

  worker.on('exit', () => {
    port1.close();
  });
}
`
  const result = proveSandboxPortTransferSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.portProof, 'DETERMINISTIC_MESSAGE_PORT_CLOSURE_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxPortTransferSafety detects unclosed transferred MessagePort', () => {
  const code = `
function establishWorkerChannel(worker) {
  const { port1, port2 } = new MessageChannel();
  worker.postMessage({ type: 'INIT' }, [port2]);
}
`
  const result = proveSandboxPortTransferSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.portProof, 'UNCLOSED_MESSAGE_PORT_LEAK_RISK')
  assert.equal(result.violationsCount, 1)
})
