import test from 'node:test'
import assert from 'node:assert/strict'
import { auditNetworkEgress } from './egress-interceptor.mjs'

test('auditNetworkEgress approves offline isolated code', () => {
  const code = `
export function computeHash(data: string) {
  return crypto.createHash('sha256').update(data).digest('hex');
}
`
  const result = auditNetworkEgress(code)
  assert.equal(result.hermetic, true)
  assert.equal(result.egressProof, 'OFFLINE_SANDBOX_EGRESS_CONTAINMENT_PROVEN')
  assert.equal(result.violationsCount, 0)
})

test('auditNetworkEgress detects unauthorized outbound sockets and DNS lookups', () => {
  const code = `
import net from 'node:net';
import dns from 'node:dns';

const socket = net.connect(8080, '192.168.1.1');
dns.lookup('example.com', () => {});
`
  const result = auditNetworkEgress(code)
  assert.equal(result.hermetic, false)
  assert.equal(result.egressProof, 'UNAUTHORIZED_NETWORK_EGRESS_DETECTED')
  assert.equal(result.violationsCount, 2)
})
