import { describe, expect, it, vi } from 'vitest'
import { aoiOsEventBus } from '../../server/utils/aoi-os-bus'

describe('aoiOsEventBus', () => {
  it('broadcasts events to subscribers and maintains history', () => {
    const received: any[] = []
    const unsub = aoiOsEventBus.subscribe((evt) => {
      received.push(evt)
    })

    const event = aoiOsEventBus.broadcast(
      'dag_transition',
      'Task T-1 moved to in_progress',
      { taskId: 'T-1' },
      'info'
    )

    expect(received.length).toBeGreaterThan(0)
    expect(received[received.length - 1].type).toBe('dag_transition')
    expect(received[received.length - 1].message).toContain('T-1')

    const history = aoiOsEventBus.getRecentEvents()
    expect(history.some((e) => e.id === event.id)).toBe(true)

    unsub()
  })
})
