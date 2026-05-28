import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { parseTaskRegistry } from '../../server/utils/parse-task-registry'

const createdDirs: string[] = []

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('parseTaskRegistry', () => {
  it('extracts feature and task rows from the markdown registry', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'ops-dashboard-registry-'))
    createdDirs.push(workspaceRoot)
    await mkdir(join(workspaceRoot, '.tasks'), { recursive: true })

    await writeFile(
      join(workspaceRoot, '.tasks', 'registry.md'),
      `# Task Registry\n\n## Features\n\n| Feature | Status | Tasks | Created |\n| ------- | ------ | ----- | ------- |\n| alpha | 🏗️ Planificado | 2 | 2026-05-26 |\n\n## Tasks\n\n| TASK-ID | Feature | Title | Status | Owner | Created | Closed |\n| ------- | ------- | ----- | ------ | ----- | ------- | ------ |\n| TASK-2026-010 | alpha | Demo title | ⚙️ En Implementación | Supervisor | 2026-05-26 | |\n`,
      { encoding: 'utf8' },
    )

    const registry = await parseTaskRegistry(workspaceRoot)
    expect(registry.features).toHaveLength(1)
    expect(registry.tasks).toHaveLength(1)
    expect(registry.tasks[0]?.id).toBe('TASK-2026-010')
  })
})