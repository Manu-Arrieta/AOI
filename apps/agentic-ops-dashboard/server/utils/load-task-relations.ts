import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { emptyTaskRelations, parseTaskRelations } from '~/shared/relations'
import type { TaskRelationReference, TaskRelations } from '~/shared/types'

export async function loadTaskRelations(
  workspaceRoot: string,
  taskDirectory: string,
): Promise<{
  relations: TaskRelations
  relationReferences: TaskRelationReference[]
  warnings: string[]
}> {
  const relationFile = join(taskDirectory, 'relations.json')
  const warnings: string[] = []

  if (!existsSync(relationFile)) {
    return {
      relations: emptyTaskRelations(),
      relationReferences: [],
      warnings,
    }
  }

  try {
    const raw = await readFile(relationFile, 'utf8')
    const relations = parseTaskRelations(JSON.parse(raw))
    const relationReferences = [
      ...relations.userstories.map((path) => ({
        bucket: 'userstories' as const,
        path,
        exists: existsSync(join(workspaceRoot, path)),
      })),
      ...relations.workflows.map((path) => ({
        bucket: 'workflows' as const,
        path,
        exists: existsSync(join(workspaceRoot, path)),
      })),
    ]

    for (const relation of relationReferences) {
      if (!relation.exists) {
        warnings.push(`Missing related resource: ${relation.path}`)
      }
    }

    return { relations, relationReferences, warnings }
  } catch {
    return {
      relations: emptyTaskRelations(),
      relationReferences: [],
      warnings: ['relations.json is present but could not be parsed.'],
    }
  }
}