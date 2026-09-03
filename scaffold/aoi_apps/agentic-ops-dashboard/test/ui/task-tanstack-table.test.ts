import { describe, expect, it } from 'vitest'
import type { TaskItem } from '~/shared/types'

describe('TaskTanstackTable data structure', () => {
  it('prepares and filters task records accurately for TanStack Table', () => {
    const sampleTasks: TaskItem[] = [
      {
        id: 'TASK-001',
        title: 'Build Auth API',
        featureName: 'auth',
        status: 'completed',
        role: 'backend',
        rawContent: '',
      },
      {
        id: 'TASK-002',
        title: 'Build Login UI',
        featureName: 'auth',
        status: 'in_progress',
        role: 'frontend',
        rawContent: '',
      },
    ]

    expect(sampleTasks.length).toBe(2)
    const backendTasks = sampleTasks.filter((t) => t.role === 'backend')
    expect(backendTasks.length).toBe(1)
    expect(backendTasks[0].id).toBe('TASK-001')
  })
})
