/**
 * scripts/aoi-os/event-sourcing/event-sourcing-kernel.mjs
 *
 * Deterministic Event-Sourcing Kernel & Temporal Projections for AOI-OS:
 * Append-only immutable event stream recording all lifecycle mutations,
 * enabling deterministic temporal state projections and microsecond replays.
 */

import crypto from 'node:crypto'

/**
 * Creates an in-memory Deterministic Event Sourcing Kernel instance.
 *
 * @param {object} [options]
 * @param {string} [options.streamId='aoi-os-events']
 * @returns {object} Event store instance
 */
export function createEventSourcingKernel(options = {}) {
  const streamId = options.streamId || 'aoi-os-events'
  const eventStream = []
  let sequence = 0

  /**
   * Appends an immutable event to the stream.
   *
   * @param {string} type (e.g. 'TASK_STARTED', 'AST_MUTATION_APPLIED', 'QUORUM_VOTE')
   * @param {object} payload
   * @param {object} [metadata={}]
   * @returns {object} Structured immutable event record
   */
  function appendEvent(type, payload = {}, metadata = {}) {
    sequence += 1
    const timestamp = Date.now()
    const rawContent = JSON.stringify({ sequence, type, payload, metadata, timestamp })
    const digest = crypto.createHash('sha256').update(rawContent).digest('hex')

    const eventRecord = Object.freeze({
      streamId,
      sequence,
      type,
      payload: Object.freeze({ ...payload }),
      metadata: Object.freeze({ ...metadata }),
      timestamp,
      digest,
    })

    eventStream.push(eventRecord)
    return eventRecord
  }

  /**
   * Queries events matching a predicate.
   *
   * @param {Function} [predicate]
   * @returns {object[]} Filtered events
   */
  function queryEvents(predicate = () => true) {
    return eventStream.filter(predicate)
  }

  /**
   * Reconstructs state by replaying events through a reducer function.
   *
   * @param {*} initialState
   * @param {Function} reducer - (state, event) => newState
   * @param {number} [upToSequence] - Optional temporal cutoff
   * @returns {*} Reconstructed state
   */
  function projectState(initialState, reducer, upToSequence = Infinity) {
    let currentState = structuredClone(initialState)

    for (const event of eventStream) {
      if (event.sequence > upToSequence) break
      currentState = reducer(currentState, event)
    }

    return currentState
  }

  return {
    streamId,
    appendEvent,
    queryEvents,
    projectState,
    getEventCount: () => eventStream.length,
    getLatestEvent: () => eventStream[eventStream.length - 1] || null,
  }
}
