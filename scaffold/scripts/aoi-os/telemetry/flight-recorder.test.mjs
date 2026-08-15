import test from 'node:test'
import assert from 'node:assert/strict'
import { createFlightRecorder } from './flight-recorder.mjs'

test('createFlightRecorder tracks nested spans and events accurately', () => {
  const recorder = createFlightRecorder({ serviceName: 'test-orchestrator' })
  assert.ok(recorder.traceId.length >= 16)

  // Root span
  const rootSpanId = recorder.startSpan('execute_wave_0', { waveIndex: 0 })
  assert.ok(rootSpanId)

  // Child span
  const childSpanId = recorder.startSpan('task_dispatch_T1', { taskId: 'T-1' }, rootSpanId)
  recorder.addSpanEvent(childSpanId, 'sandbox_mounted', { path: '.sandboxes/aoi-os-tmp-T1' })
  const childSpan = recorder.endSpan(childSpanId, 'OK')
  assert.equal(childSpan.status, 'OK')
  assert.equal(childSpan.parentSpanId, rootSpanId)
  assert.equal(childSpan.events.length, 1)

  // End root span
  const rootSpan = recorder.endSpan(rootSpanId, 'OK')
  assert.equal(rootSpan.status, 'OK')

  const log = recorder.exportFlightLog()
  assert.equal(log.totalSpans, 2)
  assert.equal(log.spans[0].spanId, childSpanId)
  assert.equal(log.spans[1].spanId, rootSpanId)
})
