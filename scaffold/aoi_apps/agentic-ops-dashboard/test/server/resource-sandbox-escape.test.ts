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

import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createResourceFolder, deleteResourceFolder, moveResourceFolder } from '../../server/utils/resource-operations'

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

describe('el separador cierra los hermanos y deja abierto el enlace', () => {
  // Segunda ronda de la misma familia. El arreglo del separador —el de arriba—
  // prueba contención sobre el resultado de `resolve()`, y `resolve()` es
  // LÉXICO: no sigue symlinks. Si un componente YA EXISTENTE del path es un
  // enlace a un directorio de afuera, `mkdir` y `rename` lo siguen y la
  // operación escribe fuera del sandbox.
  //
  // Medido por una lente adversarial antes de este arreglo: `createResourceFolder`
  // escribió un directorio afuera del workspace y `moveResourceFolder` exfiltró
  // un archivo. Las dos operaciones pasaban la guarda de strings.
  const outside = () => {
    const dir = mkdtempSync(join(tmpdir(), 'aoi-fuera-'))
    return dir
  }

  it('no deja CREAR a través de un enlace que apunta afuera', async () => {
    const fuera = outside()
    mkdirSync(join(root, '.resources/evil'), { recursive: true })
    rmSync(join(root, '.resources/evil'), { recursive: true, force: true })
    symlinkSync(fuera, join(root, '.resources/evil'))

    await expect(
      createResourceFolder({ folderName: 'adr', parentPath: '.resources/evil', purpose: 'x' }, root, noop),
    ).rejects.toThrow(/stay inside \.resources/)

    expect(existsSync(join(fuera, 'adr'))).toBe(false)
    rmSync(fuera, { recursive: true, force: true })
  })

  it('no deja MOVER a través de un enlace que apunta afuera', async () => {
    const fuera = outside()
    mkdirSync(join(root, '.resources/adr'), { recursive: true })
    writeFileSync(join(root, '.resources/adr/secret.md'), 'no sale de acá')
    symlinkSync(fuera, join(root, '.resources/evil'))

    await expect(
      moveResourceFolder(
        { sourcePath: '.resources/adr', destinationPath: '.resources/evil/adr', reason: 'x' },
        root,
        noop,
      ),
    ).rejects.toThrow(/stay inside \.resources/)

    expect(existsSync(join(fuera, 'adr'))).toBe(false)
    expect(existsSync(join(root, '.resources/adr/secret.md'))).toBe(true)
    rmSync(fuera, { recursive: true, force: true })
  })

  it('sigue operando sobre lo que está adentro y es real', async () => {
    // El control en la otra dirección: resolver symlinks no puede bloquear el
    // caso normal, porque una guarda que rechaza todo se desactiva igual que una
    // que acepta todo.
    mkdirSync(join(root, '.resources/real'), { recursive: true })

    await deleteResourceFolder({ targetPath: '.resources/real', reason: 'limpieza', confirmed: true }, root, noop)

    expect(existsSync(join(root, '.resources/real'))).toBe(false)
  })
})
