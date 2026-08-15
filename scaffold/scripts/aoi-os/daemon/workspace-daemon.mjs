/**
 * scripts/aoi-os/daemon/workspace-daemon.mjs
 *
 * Realtime Workspace Daemon Event Bus for AOI-OS:
 * Buffers and broadcasts operational events (DAG transitions, AST guards, self-healing events)
 * to consumers and SSE endpoints.
 */

/**
 * @typedef {Object} AoiOsEvent
 * @property {string} id
 * @property {'dag_transition'|'ast_guard'|'self_healing'|'circuit_breaker'|'parity_check'} type
 * @property {'info'|'warning'|'error'|'success'} level
 * @property {string} message
 * @property {Record<string, any>} payload
 * @property {string} timestamp
 */

/**
 * Creates an event bus for AOI-OS operational telemetry.
 *
 * @param {object} [options]
 * @param {number} [options.maxBufferSize=100]
 */
export function createAoiOsEventBus(options = {}) {
  const maxBufferSize = options.maxBufferSize || 100
  const buffer = []
  const listeners = new Set()

  function emit(type, message, payload = {}, level = 'info') {
    const event = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      level,
      message,
      payload,
      timestamp: new Date().toISOString(),
    }

    buffer.push(event)
    if (buffer.length > maxBufferSize) {
      buffer.shift()
    }

    for (const listener of listeners) {
      try {
        listener(event)
      } catch {
        // Safe listener isolation
      }
    }

    return event
  }

  function subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  function getRecentEvents(limit = 20) {
    return buffer.slice(-limit)
  }

  function clear() {
    buffer.length = 0
  }

  return {
    emit,
    subscribe,
    getRecentEvents,
    clear,
    getListenerCount: () => listeners.size,
  }
}
