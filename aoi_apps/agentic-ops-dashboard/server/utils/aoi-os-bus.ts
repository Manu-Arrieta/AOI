/**
 * server/utils/aoi-os-bus.ts
 *
 * Singleton Event Bus and Pipeline Registry for AOI-OS Runtime in Nitro.
 */

export interface AoiOsServerEvent {
  id: string
  timestamp: string
  type: string
  message: string
  level: 'info' | 'warning' | 'error' | 'success'
  payload: Record<string, unknown>
}

type Listener = (event: AoiOsServerEvent) => void

class AoiOsServerEventBus {
  private listeners = new Set<Listener>()
  private recentEvents: AoiOsServerEvent[] = []
  private maxBuffer = 100

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  broadcast(
    type: string,
    message: string,
    payload: Record<string, unknown> = {},
    level: 'info' | 'warning' | 'error' | 'success' = 'info'
  ): AoiOsServerEvent {
    const event: AoiOsServerEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      type,
      message,
      level,
      payload,
    }

    this.recentEvents.push(event)
    if (this.recentEvents.length > this.maxBuffer) {
      this.recentEvents.shift()
    }

    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch {
        // ignore listener errors
      }
    }

    return event
  }

  getRecentEvents(): AoiOsServerEvent[] {
    return [...this.recentEvents]
  }
}

export const aoiOsEventBus = new AoiOsServerEventBus()
