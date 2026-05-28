import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { buildWorkspaceSnapshot } from '../../server/utils/build-workspace-snapshot'

const createdDirs: string[] = []

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('buildWorkspaceSnapshot', () => {
  it('builds a task and resources snapshot from authoritative workspace files', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'ops-dashboard-snapshot-'))
    createdDirs.push(workspaceRoot)

    await mkdir(join(workspaceRoot, '.tasks', 'alpha', 'TASK-2026-010'), { recursive: true })
    await mkdir(join(workspaceRoot, '.resources', 'userstories'), { recursive: true })

    await writeFile(
      join(workspaceRoot, '.tasks', 'registry.md'),
      `# Task Registry\n\n## Features\n\n| Feature | Status | Tasks | Created |\n| ------- | ------ | ----- | ------- |\n| alpha | 🏗️ Planificado | 1 | 2026-05-26 |\n\n## Tasks\n\n| TASK-ID | Feature | Title | Status | Owner | Created | Closed |\n| ------- | ------- | ----- | ------ | ----- | ------- | ------ |\n| TASK-2026-010 | alpha | Demo title | ⚙️ En Implementación | Supervisor | 2026-05-26 | |\n`,
      'utf8',
    )
    await writeFile(join(workspaceRoot, '.resources', 'constitution.md'), '# Resources Constitution\n', 'utf8')
    await writeFile(join(workspaceRoot, '.resources', 'userstories', 'story.md'), '# Story\n', 'utf8')
    await writeFile(join(workspaceRoot, '.tasks', 'alpha', 'TASK-2026-010', 'proposal.md'), '# Proposal\n', 'utf8')
    await writeFile(
      join(workspaceRoot, '.tasks', 'alpha', 'TASK-2026-010', 'relations.json'),
      JSON.stringify({ userstories: ['.resources/userstories/story.md'], workflows: [] }),
      'utf8',
    )

    const snapshot = await buildWorkspaceSnapshot(workspaceRoot)
    expect(snapshot.workspaceName).toMatch(/^ops-dashboard-snapshot-/)
    expect(snapshot.tasks).toHaveLength(1)
    expect(snapshot.tasks[0]?.artifacts[0]?.path).toContain('.tasks/alpha/TASK-2026-010')
    expect(snapshot.tasks[0]?.relationReferences[0]?.exists).toBe(true)
    expect(snapshot.resources.some((node) => node.path === '.resources/constitution.md')).toBe(true)
  })

  it('orders task artifacts by canonical generation flow instead of filename order', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'ops-dashboard-snapshot-'))
    createdDirs.push(workspaceRoot)

    const taskDirectory = join(workspaceRoot, '.tasks', 'alpha', 'TASK-2026-010')
    await mkdir(taskDirectory, { recursive: true })

    await writeFile(
      join(workspaceRoot, '.tasks', 'registry.md'),
      `# Task Registry\n\n## Features\n\n| Feature | Status | Tasks | Created |\n| ------- | ------ | ----- | ------- |\n| alpha | 🏗️ Planificado | 1 | 2026-05-26 |\n\n## Tasks\n\n| TASK-ID | Feature | Title | Status | Owner | Created | Closed |\n| ------- | ------- | ----- | ------ | ----- | ------- | ------ |\n| TASK-2026-010 | alpha | Demo title | ⚙️ En Implementación | Supervisor | 2026-05-26 | |\n`,
      'utf8',
    )

    await mkdir(join(taskDirectory, 'iterations'), { recursive: true })
    await writeFile(join(taskDirectory, 'archive-report.md'), '# Archive\n', 'utf8')
    await writeFile(join(taskDirectory, 'context.md'), '# Context\n', 'utf8')
    await writeFile(join(taskDirectory, 'design.md'), '# Design\n', 'utf8')
    await writeFile(join(taskDirectory, 'functional-docs.md'), '# Functional docs\n', 'utf8')
    await writeFile(join(taskDirectory, 'implementation-plan.md'), '# Implementation plan\n', 'utf8')
    await writeFile(join(taskDirectory, 'proposal.md'), '# Proposal\n', 'utf8')
    await writeFile(join(taskDirectory, 'relations.json'), '{"workflows":[],"userstories":[]}', 'utf8')
    await writeFile(join(taskDirectory, 'requirement.md'), '# Requirement\n', 'utf8')
    await writeFile(join(taskDirectory, 'spec.md'), '# Spec\n', 'utf8')
    await writeFile(join(taskDirectory, 'tasks.md'), '# Tasks\n', 'utf8')
    await writeFile(join(taskDirectory, 'verify-report.md'), '# Verify\n', 'utf8')

    const snapshot = await buildWorkspaceSnapshot(workspaceRoot)

    expect(snapshot.tasks[0]?.artifacts.map((artifact) => artifact.name)).toEqual([
      'context.md',
      'proposal.md',
      'requirement.md',
      'spec.md',
      'design.md',
      'tasks.md',
      'implementation-plan.md',
      'relations.json',
      'iterations',
      'verify-report.md',
      'functional-docs.md',
      'archive-report.md',
    ])
  })
})