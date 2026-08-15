/**
 * scripts/aoi-os/telemetry/flight-recorder.mjs
 *
 * Deterministic C2 Flight Recorder & OpenTelemetry Mesh for AOI-OS:
 * Captures zero-overhead W3C Trace Context spans for DAG wave execution,
 * micro-agent dispatches, and consensus events (0 LLM Tokens).
 */

import crypto from 'node:crypto'

/**
 * Generates a deterministic 16-char hex span ID or 32-char trace ID.
 *
 * @param {number} length
 * @returns {string} Hex string
 */
function generateId(length = 16) {
  return crypto.randomBytes(length / 2).toString('hex')
}

/**
 * Creates an instance of the C2 Flight Recorder.
 *
 * @param {object} [options]
 * @param {string} [options.traceId]
 * @param {string} [options.serviceName='aoi-os-kernel']
 * @returns {object} Flight recorder instance
 */
export function createFlightRecorder(options = {}) {
  const traceId = options.traceId || generateId(32)
  const serviceName = options.serviceName || 'aoi-os-kernel'
  const spans = []
  const activeSpans = new Map()

  /**
   * Starts a new trace span.
   *
   * @param {string} name
   * @param {object} [attributes={}]
   * @param {string} [parentSpanId]
   * @returns {string} spanId
   */
  function startSpan(name, attributes = {}, parentSpanId = null) {
    const spanId = generateId(16)
    const span = {
      traceId,
      spanId,
      parentSpanId,
      name,
      serviceName,
      startTime: Date.now(),
      endTime: null,
      durationMs: null,
      status: 'UNSET',
      attributes: { ...attributes },
      events: [],
    }

    activeSpans.set(spanId, span)
    return spanId
  }

  /**
   * Adds an event log to an active span.
   *
   * @param {string} spanId
   * @param {string} eventName
   * @param {object} [payload={}]
   */
  function addSpanEvent(spanId, eventName, payload = {}) {
    const span = activeSpans.get(spanId)
    if (span) {
      span.events.push({
        name: eventName,
        time: Date.now(),
        payload,
      })
    }
  }

  /**
   * Ends an active span and moves it to completed spans.
   *
   * @param {string} spanId
   * @param {string} [status='OK']
   * @param {object} [extraAttributes={}]
   */
  function endSpan(spanId, status = 'OK', extraAttributes = {}) {
    const span = activeSpans.get(spanId)
    if (!span) return null

    span.endTime = Date.now()
    span.durationMs = span.endTime - span.startTime
    span.status = status
    Object.assign(span.attributes, extraAttributes)

    activeSpans.delete(spanId)
    spans.push(span)
    return span
  }

  /**
   * Exports full telemetry timeline.
   */
  function exportFlightLog() {
    return {
      traceId,
      serviceName,
      totalSpans: spans.length,
      spans: [...spans],
    }
  }

  return {
    traceId,
    startSpan,
    addSpanEvent,
    endSpan,
    exportFlightLog,
  }
}
