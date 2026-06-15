import type { TaskRecord, WorkspaceSnapshot } from '~/shared/types'

import { type TaskBoardLaneId, resolveTaskBoardLane, taskBoardLaneOrder } from './task-board'

export type TaskChangeDirection = 'forward' | 'backward'

export interface TaskChangeState {
  changedAt: string
  currentLane: TaskBoardLaneId
  previousLane: TaskBoardLaneId | null
  direction: TaskChangeDirection | null
  statusChanged: boolean
  laneChanged: boolean
}

function buildTaskSignature(task: TaskRecord) {
  return JSON.stringify({
    feature: task.feature,
    title: task.title,
    status: task.status,
    owner: task.owner,
    created: task.created,
    closed: task.closed,
    warnings: task.warnings,
    artifacts: task.artifacts.map((artifact) => ({
      name: artifact.name,
      path: artifact.path,
      kind: artifact.kind,
      extension: artifact.extension,
      size: artifact.size,
    })),
    relations: task.relations,
    relationReferences: task.relationReferences,
  })
}

function resolveChangeDirection(
  previousLane: TaskBoardLaneId | null,
  currentLane: TaskBoardLaneId,
): TaskChangeDirection | null {
  if (!previousLane || previousLane === currentLane) {
    return null
  }

  return taskBoardLaneOrder.indexOf(currentLane) > taskBoardLaneOrder.indexOf(previousLane)
    ? 'forward'
    : 'backward'
}

export function diffTaskChangeStates(
  previousSnapshot: WorkspaceSnapshot | null,
  nextSnapshot: WorkspaceSnapshot,
  currentChanges: Record<string, TaskChangeState>,
): Record<string, TaskChangeState> {
  const nextTasksById = new Map(nextSnapshot.tasks.map((task) => [task.id, task]))
  const retainedChanges = Object.fromEntries(
    Object.entries(currentChanges).filter(([taskId]) => nextTasksById.has(taskId)),
  )

  if (!previousSnapshot) {
    return retainedChanges
  }

  const previousTasksById = new Map(previousSnapshot.tasks.map((task) => [task.id, task]))
  const nextChanges = { ...retainedChanges }

  for (const task of nextSnapshot.tasks) {
    const previousTask = previousTasksById.get(task.id)

    if (!previousTask) {
      nextChanges[task.id] = {
        changedAt: nextSnapshot.generatedAt,
        currentLane: resolveTaskBoardLane(task.status),
        previousLane: null,
        direction: null,
        statusChanged: false,
        laneChanged: false,
      }
      continue
    }

    if (buildTaskSignature(previousTask) === buildTaskSignature(task)) {
      continue
    }

    const previousLane = resolveTaskBoardLane(previousTask.status)
    const currentLane = resolveTaskBoardLane(task.status)

    nextChanges[task.id] = {
      changedAt: nextSnapshot.generatedAt,
      currentLane,
      previousLane,
      direction: resolveChangeDirection(previousLane, currentLane),
      statusChanged: previousTask.status !== task.status,
      laneChanged: previousLane !== currentLane,
    }
  }

  return nextChanges
}

export function clearTaskChangeState(
  currentChanges: Record<string, TaskChangeState>,
  taskId: string,
): Record<string, TaskChangeState> {
  if (!(taskId in currentChanges)) {
    return currentChanges
  }

  const nextChanges = { ...currentChanges }
  delete nextChanges[taskId]

  return nextChanges
}