export const taskBoardLaneOrder = [
  'exploring',
  'proposed',
  'analysis',
  'planned',
  'implementation',
  'implemented',
  'archived',
  'sandbox',
  'cancelled',
] as const

export type TaskBoardLaneId = (typeof taskBoardLaneOrder)[number]
export type TaskBoardLaneCollapsePreference = 'collapsed' | 'expanded'

const laneMatchers: Record<TaskBoardLaneId, string[]> = {
  exploring: ['exploring', 'explorando'],
  proposed: ['proposed', 'propuesto'],
  analysis: ['in analysis', 'en analisis'],
  planned: ['planned', 'planificado'],
  implementation: ['in implementation', 'en implementacion'],
  implemented: ['implemented', 'implementado'],
  archived: ['archived', 'archivado'],
  sandbox: ['active sandbox', 'sandbox activo'],
  cancelled: ['cancelled', 'canceled', 'cancelado'],
}

function normalizeStatusValue(status: string) {
  return status
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function resolveTaskBoardLane(status: string): TaskBoardLaneId {
  const normalizedStatus = normalizeStatusValue(status)

  for (const laneId of taskBoardLaneOrder) {
    if (laneMatchers[laneId].some((match) => normalizedStatus.includes(match))) {
      return laneId
    }
  }

  return 'planned'
}

export function resolveTaskBoardLaneCollapsed(
  taskCount: number,
  preference: TaskBoardLaneCollapsePreference | null | undefined,
) {
  if (preference === 'collapsed') {
    return true
  }

  if (preference === 'expanded') {
    return false
  }

  return taskCount === 0
}