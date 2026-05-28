import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { loadTaskRelations } from '../../server/utils/load-task-relations'

const createdDirs: string[] = []

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('loadTaskRelations', () => {
  it('loads explicit relations and flags stale references without failing', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'ops-dashboard-relations-'))
    createdDirs.push(workspaceRoot)

    await mkdir(join(workspaceRoot, '.tasks', 'alpha', 'TASK-2026-010'), { recursive: true })
    await mkdir(join(workspaceRoot, '.resources', 'userstories'), { recursive: true })
    await mkdir(join(workspaceRoot, '.resources', 'workflows'), { recursive: true })

    await writeFile(join(workspaceRoot, '.resources', 'userstories', 'story.md'), '# Story\n', 'utf8')
    await writeFile(
      join(workspaceRoot, '.tasks', 'alpha', 'TASK-2026-010', 'relations.json'),
      JSON.stringify({
        userstories: ['.resources/userstories/story.md'],
        workflows: ['.resources/workflows/missing.md'],
      }),
      'utf8',
    )

    const result = await loadTaskRelations(workspaceRoot, join(workspaceRoot, '.tasks', 'alpha', 'TASK-2026-010'))
    expect(result.relationReferences).toHaveLength(2)
    expect(result.relationReferences[1]?.exists).toBe(false)
    expect(result.warnings).toContain('Missing related resource: .resources/workflows/missing.md')
  })
})