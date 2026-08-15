import test from 'node:test'
import assert from 'node:assert/strict'
import { createAoiOsEventBus } from './workspace-daemon.mjs'

test('createAoiOsEventBus emits events and notifies subscribers', () => {
  const bus = createAoiOsEventBus({ maxBufferSize: 5 })
  const received = []

  const unsubscribe = bus.subscribe((evt) => {
    received.push(evt)
  })

  assert.equal(bus.getListenerCount(), 1)

  bus.emit('dag_transition', 'Task T-1 ready', { taskId: 'T-1' }, 'info')
  bus.emit('self_healing', 'Fix attempt 1', { attempt: 1 }, 'warning')

  assert.equal(received.length, 2)
  assert.equal(received[0].type, 'dag_transition')
  assert.equal(received[1].level, 'warning')

  const recent = bus.getRecentEvents(10)
  assert.equal(recent.length, 2)

  unsubscribe()
  assert.equal(bus.getListenerCount(), 0)
})

test('createAoiOsEventBus bounds buffer to maxBufferSize', () => {
  const bus = createAoiOsEventBus({ maxBufferSize: 3 })
  for (let i = 1; i <= 5; i++) {
    bus.emit('ast_guard', `Check ${i}`, { index: i })
  }

  const events = bus.getRecentEvents(10)
  assert.equal(events.length, 3)
  assert.equal(events[0].payload.index, 3)
  assert.equal(events[2].payload.index, 5)
})
