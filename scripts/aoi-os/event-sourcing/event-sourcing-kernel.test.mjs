import test from 'node:test'
import assert from 'node:assert/strict'
import { createEventSourcingKernel } from './event-sourcing-kernel.mjs'

test('createEventSourcingKernel appends immutable events and deterministically projects state', () => {
  const kernel = createEventSourcingKernel({ streamId: 'feature-stream' })

  kernel.appendEvent('TASK_CREATED', { taskId: 'T-1', status: 'pending' })
  kernel.appendEvent('TASK_STARTED', { taskId: 'T-1', status: 'in_progress' })
  kernel.appendEvent('TASK_COMPLETED', { taskId: 'T-1', status: 'completed' })

  assert.equal(kernel.getEventCount(), 3)
  assert.equal(kernel.getLatestEvent().type, 'TASK_COMPLETED')
  assert.ok(kernel.getLatestEvent().digest.length === 64)

  // Reducer for state projection
  const reducer = (state, event) => {
    if (event.type === 'TASK_CREATED') {
      state.tasks[event.payload.taskId] = event.payload.status
    }
    if (event.type === 'TASK_STARTED' || event.type === 'TASK_COMPLETED') {
      state.tasks[event.payload.taskId] = event.payload.status
    }
    return state
  }

  // 1. Full projection
  const finalState = kernel.projectState({ tasks: {} }, reducer)
  assert.equal(finalState.tasks['T-1'], 'completed')

  // 2. Temporal time-travel projection up to sequence 2
  const midState = kernel.projectState({ tasks: {} }, reducer, 2)
  assert.equal(midState.tasks['T-1'], 'in_progress')
})
