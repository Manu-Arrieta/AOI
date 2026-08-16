import test from 'node:test'
import assert from 'node:assert/strict'
import { auditWebSocketHeartbeat } from './websocket-heartbeat-guard.mjs'

test('auditWebSocketHeartbeat approves WebSocket handler with interval teardown on close', () => {
  const code = `
const wss = new WebSocketServer({ port: 8080 });
wss.on('connection', (ws) => {
  const timer = setInterval(() => ws.ping(), 30000);
  ws.on('close', () => clearInterval(timer));
});
`
  const result = auditWebSocketHeartbeat(code)
  assert.equal(result.safe, true)
  assert.equal(result.heartbeatProof, 'WEBSOCKET_HEARTBEAT_TEARDOWN_PROVEN')
  assert.equal(result.violationsCount, 0)
})

test('auditWebSocketHeartbeat detects WebSocket handler missing heartbeat teardown', () => {
  const code = `
const wss = new WebSocketServer({ port: 8080 });
wss.on('connection', (ws) => {
  const timer = setInterval(() => ws.ping(), 30000);
});
`
  const result = auditWebSocketHeartbeat(code)
  assert.equal(result.safe, false)
  assert.equal(result.heartbeatProof, 'LEAKING_WEBSOCKET_HEARTBEAT_DETECTED')
  assert.equal(result.violationsCount, 1)
})
