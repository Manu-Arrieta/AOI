import { describe, expect, it } from 'vitest'
import { aoiOsEventBus } from '../../server/utils/aoi-os-bus'

describe('AOI-OS Playback Control', () => {
  it('broadcasts playback control events through the event bus', () => {
    const received: any[] = []
    const unsub = aoiOsEventBus.subscribe((evt) => {
      received.push(evt)
    })

    const evt = aoiOsEventBus.broadcast(
      'aoi-os:control',
      'AOI-OS Playback command received: [pause]',
      { command: 'pause' },
      'warning'
    )

    expect(evt.type).toBe('aoi-os:control')
    expect(received.some((e) => e.type === 'aoi-os:control')).toBe(true)

    unsub()
  })
})
