import { createEventStream, defineEventHandler } from 'h3'
import { aoiOsEventBus } from '../../utils/aoi-os-bus'

export default defineEventHandler(async (event) => {
  const stream = createEventStream(event)

  const unsubscribe = aoiOsEventBus.subscribe((payload) => {
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

  // Send initial connected event with buffered events
  await stream.push({
    event: 'aoi-os:connected',
    data: JSON.stringify({
      type: 'aoi-os:connected',
      message: 'AOI-OS C2 Telemetry Stream connected',
      level: 'success',
      payload: { history: aoiOsEventBus.getRecentEvents() },
    }),
  })

  return sendPromise
})
