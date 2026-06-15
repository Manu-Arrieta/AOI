import { describe, expect, it } from 'vitest'

import type { TaskRecord, WorkspaceSnapshot } from '../../shared/types'
import { clearTaskChangeState, diffTaskChangeStates } from '../../app/utils/task-changes'

function buildTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'TASK-2026-010',
    feature: 'agentic-ops-dashboard',
    title: 'Animate realtime task updates',
    status: '🏗️ Planificado',
    owner: 'Supervisor',
    created: '2026-05-27',
    closed: null,
    directoryPath: '.tasks/agentic-ops-dashboard/TASK-2026-010',
    artifacts: [],
    relations: {
      userstories: [],
      workflows: [],
    },
    relationReferences: [],
    warnings: [],
    ...overrides,
  }
}

function buildSnapshot(tasks: TaskRecord[], generatedAt = '2026-05-27T19:30:00.000Z'): WorkspaceSnapshot {
  return {
    workspaceName: 'aoi',
    generatedAt,
    features: [],
    tasks,
    resources: [],
    warnings: [],
    counts: {
      features: 0,
      tasks: tasks.length,
      activeTasks: tasks.length,
    },
  }
}

describe('task change helpers', () => {
  it('does not mark the initial snapshot as changed', () => {
    const snapshot = buildSnapshot([buildTask()])

    expect(diffTaskChangeStates(null, snapshot, {})).toEqual({})
  })

  it('marks lane transitions and clears them when acknowledged', () => {
    const previousSnapshot = buildSnapshot([buildTask()], '2026-05-27T19:30:00.000Z')
    const nextSnapshot = buildSnapshot([
      buildTask({
        status: '⚙️ En Implementación',
      }),
    ], '2026-05-27T19:31:00.000Z')

    const taskChanges = diffTaskChangeStates(previousSnapshot, nextSnapshot, {})

    expect(taskChanges['TASK-2026-010']).toMatchObject({
      currentLane: 'implementation',
      previousLane: 'planned',
      direction: 'forward',
      statusChanged: true,
      laneChanged: true,
    })
    expect(clearTaskChangeState(taskChanges, 'TASK-2026-010')).toEqual({})
  })
})