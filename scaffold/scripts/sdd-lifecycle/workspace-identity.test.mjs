/**
 * scripts/sdd-lifecycle/workspace-identity.test.mjs
 *
 * Control negativo de la resolución de entidad, y no es ceremonia.
 *
 * El gate auto-resuelve el nombre del workspace cuando no se le pasa
 * `--entity`. Si esa resolución elige mal, audita **otra entidad** — y una
 * entidad sin hechos `bic.*` da `SKIPPED`, que sale 0. Es decir: una
 * resolución equivocada es indistinguible de aprobar. Eso es exactamente el
 * falso verde que estas compuertas existen para cazar, así que la prioridad
 * entre las dos fuentes se prueba sobre repositorios de verdad, no con mocks.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'
import { resolveWorkspaceEntity, workspaceFromGitRemote } from './workspace-identity.mjs'

const SANDBOXES = []

after(() => {
  for (const dir of SANDBOXES) fs.rmSync(dir, { recursive: true, force: true })
})

/** Un directorio temporal, opcionalmente convertido en repo git. */
function sandbox(name, remote = '') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-wsid-'))
  const dir = path.join(root, name)
  fs.mkdirSync(dir, { recursive: true })
  SANDBOXES.push(root)
  if (remote) {
    execFileSync('git', ['init', '-q'], { cwd: dir, stdio: 'ignore' })
    execFileSync('git', ['remote', 'add', 'origin', remote], { cwd: dir, stdio: 'ignore' })
  }
  return dir
}

describe('la prioridad es la que fija el protocolo ICM', () => {
  it('sin remoto, cae al basename del directorio', () => {
    const dir = sandbox('mi-workspace')
    assert.equal(workspaceFromGitRemote(dir), '')
    assert.equal(resolveWorkspaceEntity(dir).entity, 'mi-workspace')
  })

  it('con remoto, gana el remoto aunque el directorio se llame distinto', () => {
    // El caso real: el directorio local dice "AOI TESTS" y el remoto dice otra
    // cosa. Si el gate eligiera el directorio, auditaría una entidad que
    // /sdd-frame nunca pobló → SKIPPED → exit 0 → pase silencioso.
    const dir = sandbox('AOI TESTS', 'https://github.com/acme/portal-comercial.git')
    assert.equal(resolveWorkspaceEntity(dir).entity, 'portal-comercial')
  })

  it('saca el sufijo .git en las tres formas de remoto', () => {
    for (const remote of [
      'git@github.com:acme/portal.git',
      'https://github.com/acme/portal.git',
      'https://github.com/acme/portal',
    ]) {
      const dir = sandbox('cualquiera', remote)
      assert.equal(workspaceFromGitRemote(dir), 'portal', `falló con ${remote}`)
    }
  })

  it('un directorio que no es repo no explota: responde por basename', () => {
    const dir = sandbox('sin-git')
    const r = resolveWorkspaceEntity(dir)
    assert.equal(r.entity, 'sin-git')
    assert.match(r.source, /sin remoto/i)
  })
})

describe('la resolución se anuncia, porque auditar mal es aprobar', () => {
  it('el aviso nombra la entidad y el criterio', () => {
    const dir = sandbox('anunciado', 'https://github.com/acme/anunciado-repo.git')
    const r = resolveWorkspaceEntity(dir)
    assert.ok(r.notice.includes('anunciado-repo'), 'el aviso no dice QUÉ entidad se auditó')
    assert.ok(/git remote origin/.test(r.notice), 'el aviso no dice DE DÓNDE salió')
  })

  it('el aviso distingue el respaldo del remoto', () => {
    const dir = sandbox('respaldado')
    const r = resolveWorkspaceEntity(dir)
    assert.ok(/sin remoto origin/.test(r.notice), 'no avisa que está usando el respaldo')
  })
})
