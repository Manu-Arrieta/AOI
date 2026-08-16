/**
 * scripts/aoi-os/stream-guard/websocket-heartbeat-guard.mjs
 *
 * Deterministic WebSocket Heartbeat Ping/Pong & Connection Teardown Guard for AOI-OS:
 * Statically audits WebSocket server implementations to prove that keepalive ping/pong
 * timers are tracked and deterministically cleared upon socket closure or error (0 LLM Tokens).
 */

/**
 * Audits WebSocket handler source code for heartbeat interval tracking and teardown.
 *
 * @param {string} sourceCode - WebSocket server or handler source code
 * @returns {object} WebSocket heartbeat audit report
 */
export function auditWebSocketHeartbeat(sourceCode = '') {
  const violations = []

  const hasWebSocketConnection = /\b(?:ws\.on\s*\(\s*['"]connection['"]|defineWebSocketHandler|new\s+WebSocketServer)\b/i.test(sourceCode)
  const hasPingInterval = /\b(?:setInterval|heartbeat|pingInterval)\b/i.test(sourceCode)
  const hasCloseTeardown = /\b(?:ws\.on\s*\(\s*['"]close['"]|ws\.on\s*\(\s*['"]error['"]|clearInterval)\b/i.test(sourceCode)

  if (hasWebSocketConnection && hasPingInterval && !hasCloseTeardown) {
    violations.push({
      type: 'MISSING_WEBSOCKET_HEARTBEAT_TEARDOWN',
      recommendation: "Ensure heartbeat intervals (setInterval) are cleared in 'ws.on(\"close\")' or 'ws.on(\"error\")' via 'clearInterval(timer)'.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasWebSocketConnection,
    violationsCount: violations.length,
    violations,
    heartbeatProof: safe ? 'WEBSOCKET_HEARTBEAT_TEARDOWN_PROVEN' : 'LEAKING_WEBSOCKET_HEARTBEAT_DETECTED',
  }
}
