import test from 'node:test'
import assert from 'node:assert/strict'
import { auditStreamHalfCloseSafety } from './stream-half-close-guard.mjs'

test('auditStreamHalfCloseSafety approves socket with allowHalfOpen and destroy handler', () => {
  const code = `
const socket = net.createConnection({ port: 8080, allowHalfOpen: true });
socket.on('end', () => {
  socket.destroy();
});
`
  const result = auditStreamHalfCloseSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.halfCloseProof, 'HALF_OPEN_SOCKET_TEARDOWN_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditStreamHalfCloseSafety detects socket with allowHalfOpen missing teardown', () => {
  const code = `
const socket = net.createConnection({ port: 8080, allowHalfOpen: true });
socket.write('data');
// Missing end/close/destroy
`
  const result = auditStreamHalfCloseSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.halfCloseProof, 'ORPHANED_CLOSE_WAIT_SOCKET_RISK')
  assert.equal(result.violationsCount, 1)
})
