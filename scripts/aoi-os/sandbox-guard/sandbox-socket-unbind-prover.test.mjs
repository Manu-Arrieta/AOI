import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSocketUnbindSafety } from './sandbox-socket-unbind-prover.mjs'

test('proveSocketUnbindSafety approves test server with close teardown in afterAll', () => {
  const code = `
const server = http.createServer();
server.listen(3000);
afterAll(() => {
  server.close();
});
`
  const result = proveSocketUnbindSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.socketProof, 'NETWORK_SOCKET_UNBIND_GUARANTEED')
  assert.equal(result.violationsCount, 0)
})

test('proveSocketUnbindSafety detects listening server missing teardown hook', () => {
  const code = `
const server = http.createServer();
server.listen(3000);
`
  const result = proveSocketUnbindSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.socketProof, 'UNCLOSED_LISTEN_SOCKET_DETECTED')
  assert.equal(result.violationsCount, 1)
})
