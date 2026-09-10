import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createResourceFolder,
  deleteResourceFolder,
  moveResourceFolder,
  ResourceOperationError,
  type PersistResourceChange,
} from '../../server/utils/resource-operations'

const createdDirs: string[] = []

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

async function makeWorkspace() {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'ops-dashboard-resources-'))
  createdDirs.push(workspaceRoot)
  await mkdir(join(workspaceRoot, '.resources', 'userstories'), { recursive: true })
  await mkdir(join(workspaceRoot, '.resources', 'workflows'), { recursive: true })
  await writeFile(join(workspaceRoot, '.resources', 'constitution.md'), '# Resources Constitution\n', 'utf8')
  return workspaceRoot
}

describe('resource operations', () => {

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
describe('a deletion the workspace cannot record does not happen', () => {
  it('restores the folder when the persistence gate fails', async () => {
    // The shipped order was rm → constitution → persist, and persist throws
    // 500 when ICM is unavailable. So the one case the gate exists to prevent
    // — an ungoverned deletion — was the case where the folder was already
    // gone, recursively, with nothing recorded anywhere.
    const workspace = await makeWorkspace()
    await createResourceFolder(
      { folderName: 'contratos', parentPath: '.resources', purpose: 'documentos' },
      workspace,
      async () => {}
    )
    const folder = join(workspace, '.resources/contratos')
    await writeFile(join(folder, 'importante.md'), '# no me borres\n')

    const failingGate: PersistResourceChange = async () => {
      throw new ResourceOperationError('ICM is unavailable, so the governed operation cannot be persisted.', 500)
    }

    await expect(
      deleteResourceFolder({ targetPath: '.resources/contratos', reason: 'prueba', confirmed: true }, workspace, failingGate)
    ).rejects.toThrow(/ICM is unavailable/)

    expect(existsSync(folder), 'la carpeta se borró aunque no se pudo registrar').toBe(true)
    expect(await readFile(join(folder, 'importante.md'), 'utf8')).toBe('# no me borres\n')
    expect(existsSync(`${folder}.aoi-pending-delete`), 'quedó una carpeta de cuarentena huérfana').toBe(false)

    // And the constitution still lists it, so the workspace is consistent.
    const constitution = await readFile(join(workspace, '.resources/constitution.md'), 'utf8')
    expect(constitution).toContain('.resources/contratos')
  })

  it('leaves nothing behind when the gate passes', async () => {
    const workspace = await makeWorkspace()
    await createResourceFolder(
      { folderName: 'temporal', parentPath: '.resources', purpose: 'documentos' },
      workspace,
      async () => {}
    )
    const folder = join(workspace, '.resources/temporal')

    await deleteResourceFolder({ targetPath: '.resources/temporal', reason: 'prueba', confirmed: true }, workspace, async () => {})

    expect(existsSync(folder)).toBe(false)
    expect(existsSync(`${folder}.aoi-pending-delete`)).toBe(false)
    const constitution = await readFile(join(workspace, '.resources/constitution.md'), 'utf8')
    expect(constitution).not.toContain('.resources/temporal')
  })
})
