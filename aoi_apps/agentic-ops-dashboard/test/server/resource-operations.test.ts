import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createResourceFolder,
  deleteResourceFolder,
  moveResourceFolder,
  ResourceOperationError,
} from '../../server/utils/resource-operations'

const createdDirs: string[] = []

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('resource operations', () => {
  async function makeWorkspace() {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'ops-dashboard-resources-'))
    createdDirs.push(workspaceRoot)
    await mkdir(join(workspaceRoot, '.resources', 'userstories'), { recursive: true })
    await mkdir(join(workspaceRoot, '.resources', 'workflows'), { recursive: true })
    await writeFile(join(workspaceRoot, '.resources', 'constitution.md'), '# Resources Constitution\n', 'utf8')
    return workspaceRoot
  }

  it('creates, moves, and deletes governed resource folders while updating the constitution', async () => {
    const workspaceRoot = await makeWorkspace()
    const persist = vi.fn().mockResolvedValue(undefined)

    await createResourceFolder(
      { folderName: 'research', parentPath: '.resources', purpose: 'Capture findings' },
      workspaceRoot,
      persist,
    )
    await moveResourceFolder(
      { sourcePath: '.resources/research', destinationPath: '.resources/analysis', reason: 'Rename bucket' },
      workspaceRoot,
      persist,
    )
    await deleteResourceFolder(
      { targetPath: '.resources/analysis', reason: 'Cleanup', confirmed: true },
      workspaceRoot,
      persist,
    )

    const constitution = await readFile(join(workspaceRoot, '.resources', 'constitution.md'), 'utf8')
    expect(constitution).toContain('managed-folders:start')
    expect(persist).toHaveBeenCalledTimes(3)
  })

  it('rejects protected default folder deletions', async () => {
    const workspaceRoot = await makeWorkspace()

    await expect(
      deleteResourceFolder(
        { targetPath: '.resources/userstories', reason: 'Nope', confirmed: true },
        workspaceRoot,
        vi.fn(),
      ),
    ).rejects.toBeInstanceOf(ResourceOperationError)
  })
})