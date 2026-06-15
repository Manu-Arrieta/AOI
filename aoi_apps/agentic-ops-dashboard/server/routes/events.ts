import { createEventStream, defineEventHandler } from 'h3'

import { buildReadyEvent, ensureWorkspaceWatcher, subscribeWorkspaceEvents } from '../utils/watch-workspace'

export default defineEventHandler(async (event) => {
  await ensureWorkspaceWatcher()

  const stream = createEventStream(event)
  const unsubscribe = subscribeWorkspaceEvents((payload) => {
    void stream.push({
      event: payload.type,
      data: JSON.stringify(payload),
    })
  })

  stream.onClosed(async () => {
    unsubscribe()
    await stream.close()
  })

  const sendPromise = stream.send()

  await stream.push({
    event: 'workspace:ready',
    data: JSON.stringify(buildReadyEvent()),
  })

  return sendPromise
})