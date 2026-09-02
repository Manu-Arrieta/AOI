import { describe, expect, it, vi } from 'vitest'

vi.mock('h3', () => ({
  defineEventHandler: <T>(handler: T) => handler,
}))

import doctorHandler from '../../server/api/doctor.get'

describe('Doctor API Route', () => {
  it('returns structured doctor report', async () => {
    const response = await doctorHandler({} as any)

    expect(response.success).toBe(true)
    expect(response.timestamp).toBeDefined()
    expect(response.report).toBeDefined()
    expect(typeof response.report.ok).toBe('boolean')
    expect(response.report.checks.length).toBeGreaterThan(0)
  })
})
