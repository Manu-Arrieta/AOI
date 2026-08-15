import { defineEventHandler, readBody } from 'h3'
import { aoiOsEventBus } from '../../utils/aoi-os-bus'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    action?: string
    taskId?: string
    tasksMarkdown?: string
  }>(event)

  const action = body?.action || 'validate'
  const taskId = body?.taskId || 'TASK-MANUAL'

  aoiOsEventBus.broadcast(
    'aoi-os:dispatch',
    `AOI-OS dispatched action [${action}] for task [${taskId}]`,
    { action, taskId, timestamp: new Date().toISOString() },
    'info'
  )

  if (action === 'simulate_run') {
    aoiOsEventBus.broadcast(
      'dag_transition',
      `Wave 1 active: Task [${taskId}] scheduled to @backend micro-agent`,
      { taskId, wave: 1, role: 'backend', status: 'in_progress' },
      'info'
    )

    aoiOsEventBus.broadcast(
      'ast_guard',
      `Polyglot AST Invariant verified: 0 contract violations`,
      { taskId, blastRadius: 'low', safe: true },
      'success'
    )

    aoiOsEventBus.broadcast(
      'dag_transition',
      `Task [${taskId}] successfully completed wave execution`,
      { taskId, status: 'completed' },
      'success'
    )
  }

  return {
    ok: true,
    action,
    taskId,
    dispatchedAt: new Date().toISOString(),
  }
})
