import { createError, defineEventHandler, getRouterParam } from 'h3'

import { buildWorkspaceSnapshot } from '../../utils/build-workspace-snapshot'
import { ensureWorkspaceWatcher } from '../../utils/watch-workspace'

export default defineEventHandler(async (event) => {
  const taskId = getRouterParam(event, 'taskId')
  await ensureWorkspaceWatcher()
  const snapshot = await buildWorkspaceSnapshot()
  const task = snapshot.tasks.find((entry) => entry.id === taskId)

  if (!task) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Task not found.',
    })
  }

  return task
})