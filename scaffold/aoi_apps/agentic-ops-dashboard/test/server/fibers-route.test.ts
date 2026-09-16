import { describe, it, expect, vi } from 'vitest'

vi.mock('h3', () => ({
  defineEventHandler: <T>(handler: T) => handler,
}))

import fibersHandler from '../../server/api/fibers.get'

describe('server/api/fibers.get', () => {
  it('BIC-2026-002:never.2 returns a synthetic local Fiber model, not agent telemetry', async () => {
    const event = {} as any
    const response = await fibersHandler(event)

    expect(response.success).toBe(true)
    expect(response.metrics.totalFibers).toBeGreaterThanOrEqual(2)
    expect(response.metrics.providedKeys).toContain('orchestrator')
    expect(Array.isArray(response.fibers)).toBe(true)
    expect(response.fibers.some((f: any) => f.name === 'supervisor-fiber')).toBe(true)
    expect(response.observability).toMatchObject({
      source: 'synthetic-local-runtime',
      liveAgentExecution: false,
      filesystemTelemetry: false,
      rollbackTelemetry: false,
    })
  })
})
