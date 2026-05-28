import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const callOrder: string[] = []
  let sendStarted = false

  const stream = {
    close: vi.fn(async () => {
      callOrder.push('close')
    }),
    onClosed: vi.fn(),
    push: vi.fn((payload: { event?: string }) => {
      callOrder.push(`push:${payload.event ?? 'message'}`)

      if (payload.event === 'workspace:ready' && !sendStarted) {
        return new Promise<void>(() => {})
      }

      return Promise.resolve()
    }),
    send: vi.fn(async () => {
      sendStarted = true
      callOrder.push('send')
    }),
  }

  return {
    callOrder,
    stream,
    defineEventHandler: <T>(handler: T) => handler,
    createEventStream: vi.fn(() => stream),
    ensureWorkspaceWatcher: vi.fn().mockResolvedValue(undefined),
    subscribeWorkspaceEvents: vi.fn(() => vi.fn()),
    buildReadyEvent: vi.fn(() => ({
      id: 'ready-event',
      type: 'workspace:ready',
      changedPath: null,
      reason: 'connected',
      generatedAt: '2026-05-27T00:00:00.000Z',
    })),
    reset() {
      callOrder.length = 0
      sendStarted = false
      stream.close.mockClear()
      stream.onClosed.mockClear()
      stream.push.mockClear()
      stream.send.mockClear()
    },
  }
})

vi.mock('h3', () => ({
  createEventStream: mocks.createEventStream,
  defineEventHandler: mocks.defineEventHandler,
}))

vi.mock('../../server/utils/watch-workspace', () => ({
  ensureWorkspaceWatcher: mocks.ensureWorkspaceWatcher,
  subscribeWorkspaceEvents: mocks.subscribeWorkspaceEvents,
  buildReadyEvent: mocks.buildReadyEvent,
}))

import eventsHandler from '../../server/routes/events'

describe('events route', () => {
  afterEach(() => {
    mocks.reset()
    mocks.ensureWorkspaceWatcher.mockClear()
    mocks.subscribeWorkspaceEvents.mockClear()
    mocks.buildReadyEvent.mockClear()
  })

  it('starts the stream before pushing workspace:ready', async () => {
    const result = await Promise.race([
      eventsHandler({} as never).then(() => 'resolved'),
      new Promise<'timed-out'>((resolve) => {
        setTimeout(() => resolve('timed-out'), 50)
      }),
    ])

    expect(result).toBe('resolved')
    expect(mocks.callOrder.slice(0, 2)).toEqual(['send', 'push:workspace:ready'])
    expect(mocks.ensureWorkspaceWatcher).toHaveBeenCalledTimes(1)
    expect(mocks.subscribeWorkspaceEvents).toHaveBeenCalledTimes(1)
  })
})