import type { TaskRelationBucket, TaskRelations } from './types'
import { taskRelationsSchema } from './types'

const relationBuckets: TaskRelationBucket[] = ['userstories', 'workflows']

export function emptyTaskRelations(): TaskRelations {
  return {
    userstories: [],
    workflows: [],
  }
}

export function classifyResourcePath(resourcePath: string): TaskRelationBucket | null {
  if (resourcePath.startsWith('.resources/userstories/')) {
    return 'userstories'
  }

  if (resourcePath.startsWith('.resources/workflows/')) {
    return 'workflows'
  }

  return null
}

export function normalizeTaskRelations(input: Partial<TaskRelations> | null | undefined): TaskRelations {
  const base = emptyTaskRelations()

  for (const bucket of relationBuckets) {
    const values = input?.[bucket] ?? []
    base[bucket] = [...new Set(values)].sort()
  }

  return taskRelationsSchema.parse(base)
}

export function buildTaskRelations(resourcePaths: string[]): TaskRelations {
  const grouped = emptyTaskRelations()

  for (const resourcePath of resourcePaths) {
    const bucket = classifyResourcePath(resourcePath)
    if (!bucket) {
      continue
    }

    grouped[bucket].push(resourcePath)
  }

  return normalizeTaskRelations(grouped)
}

export function mergeTaskRelations(current: Partial<TaskRelations>, next: Partial<TaskRelations>): TaskRelations {
  return normalizeTaskRelations({
    userstories: [...(current.userstories ?? []), ...(next.userstories ?? [])],
    workflows: [...(current.workflows ?? []), ...(next.workflows ?? [])],
  })
}

export function parseTaskRelations(input: unknown): TaskRelations {
  return normalizeTaskRelations(taskRelationsSchema.parse(input))
}

export function hasTaskRelations(relations: TaskRelations): boolean {
  return relations.userstories.length > 0 || relations.workflows.length > 0
}