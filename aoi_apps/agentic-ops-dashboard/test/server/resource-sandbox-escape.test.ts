/**
 * El sandbox de .resources es contención, no prefijo de string.
 *
 * Una auditoría adversaria reprodujo el escape de punta a punta: la guarda era
 * `absolutePath.startsWith(resourcesRoot)` sin separador, así que cualquier
 * hermano cuyo nombre EMPIEZA con `.resources` pasaba. Un POST a
 * /api/resources/delete con `.resources-production-backup` llegaba a
 * `rm(target, { recursive: true })` y destruía un árbol que nunca estuvo
 * dentro del sandbox.
 *
 * Las rutas validan `z.string().min(1)` y nada más, así que no hay nada aguas
 * arriba que angoste el path: esta guarda es la única.
 */

import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { deleteResourceFolder, moveResourceFolder } from '../../server/utils/resource-operations'

let root: string
const noop = async () => {}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'aoi-sandbox-'))
  mkdirSync(join(root, '.resources'), { recursive: true })
  writeFileSync(join(root, '.resources/constitution.md'), '# c\n<!-- managed-folders:start -->\n- None\n<!-- managed-folders:end -->\n')
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('a sibling that merely starts with .resources is outside the sandbox', () => {
  it('refuses to delete .resources-production-backup', async () => {
    const victim = join(root, '.resources-production-backup')
    mkdirSync(join(victim, 'nested'), { recursive: true })
    writeFileSync(join(victim, 'nested/importante.md'), 'trabajo real del Owner')

    await expect(
      deleteResourceFolder({ targetPath: '.resources-production-backup', reason: 'x', confirmed: true }, root, noop),
    ).rejects.toThrow(/stay inside \.resources/)

    expect(existsSync(join(victim, 'nested/importante.md'))).toBe(true)
  })

  it('refuses to move a governed folder out to an escaped sibling', async () => {
    mkdirSync(join(root, '.resources/adr'), { recursive: true })

    await expect(
      moveResourceFolder(
        { sourcePath: '.resources/adr', destinationPath: '.resources-external/adr', reason: 'x' },
        root,
        noop,
      ),
    ).rejects.toThrow(/stay inside \.resources/)

    expect(existsSync(join(root, '.resources/adr'))).toBe(true)
  })

  it('still refuses a plain traversal, which resolve() normalises first', async () => {
    await expect(
      deleteResourceFolder({ targetPath: '../fuera', reason: 'x', confirmed: true }, root, noop),
    ).rejects.toThrow(/stay inside \.resources/)
  })

  it('keeps operating on what IS inside, so the fix does not lock the sandbox', async () => {
    // Una guarda que rechaza todo también "arregla" el escape, y sería peor.
    mkdirSync(join(root, '.resources/borrable'), { recursive: true })

    await deleteResourceFolder({ targetPath: '.resources/borrable', reason: 'limpieza', confirmed: true }, root, noop)

    expect(existsSync(join(root, '.resources/borrable'))).toBe(false)
  })
})
