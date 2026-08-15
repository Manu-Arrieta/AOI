import { defineEventHandler, readBody } from 'h3'
import { aoiOsEventBus } from '../../utils/aoi-os-bus'

export interface AoiOsControlBody {
  command: 'pause' | 'resume' | 'step' | 'retry_wave'
  waveNumber?: number
  taskId?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<AoiOsControlBody>(event)
  const command = body?.command || 'pause'

  let message = `AOI-OS Playback command received: [${command}]`
  if (body?.waveNumber) {
    message += ` for Wave ${body.waveNumber}`
  }
  if (body?.taskId) {
    message += ` (Task: ${body.taskId})`
  }

  const broadcastEvent = aoiOsEventBus.broadcast(
    'aoi-os:control',
    message,
    {
      command,
      waveNumber: body?.waveNumber,
      taskId: body?.taskId,
      timestamp: new Date().toISOString(),
    },
    command === 'pause' ? 'warning' : 'info'
  )

  return {
    ok: true,
    command,
    eventId: broadcastEvent.id,
    timestamp: broadcastEvent.timestamp,
  }
})
