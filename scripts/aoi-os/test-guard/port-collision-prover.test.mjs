import test from 'node:test'
import assert from 'node:assert/strict'
import { provePortCollisionSafety } from './port-collision-prover.mjs'

test('provePortCollisionSafety approves ephemeral port binding', () => {
  const code = `
const server = http.createServer(app);
server.listen(0, () => {
  const port = server.address().port;
});
`
  const result = provePortCollisionSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.portProof, 'EPHEMERAL_PORT_BINDING_PROVEN')
  assert.equal(result.violationsCount, 0)
})

test('provePortCollisionSafety detects hardcoded port collision risk', () => {
  const code = `
const server = http.createServer(app);
server.listen(3000, () => {
  console.log('Listening on port 3000');
});
`
  const result = provePortCollisionSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.portProof, 'HARDCODED_PORT_COLLISION_DETECTED')
  assert.equal(result.violationsCount, 1)
})
