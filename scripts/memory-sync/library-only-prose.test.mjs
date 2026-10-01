/**
 * scripts/memory-sync/library-only-prose.test.mjs
 *
 * La prosa no puede mandar a ejecutar un módulo que se niega a ejecutarse.
 *
 * Medido (auditoría 2026-09-30, D5): `memory-governance/SKILL.md:65` decía
 * `node scripts/memory-sync/rollback-version.mjs "$WORKSPACE" "$targetVersionId"`.
 * Ese módulo es una API (`refuseDirectExecution`): el comando sale 1 sin hacer
 * nada, y contradice a `icm-protocol.instructions.md`, que dice que no es un CLI.
 * Un agente que siguiera la skill fallaba siempre en el paso del rollback.
 *
 * Dos aserciones: ninguna prosa invoca con `node` un módulo library-only, y el
 * comando que la skill da EN SU LUGAR se ejecuta tal cual —extraído del
 * markdown, no copiado acá— y hace el rollback en un workspace de fixture.
 */

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { activateVersion } from './activate-version.mjs'
import { prepareVersionManifest } from './prepare-version-manifest.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const SKILL = path.join(ROOT, '.github/skills/memory-governance/SKILL.md')
const PROSE_DIRS = ['.github/skills', '.github/prompts', '.github/instructions', '.agents/skills', '.claude/commands']

const libraryOnly = fs.readdirSync(HERE)
  .filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs') && f !== 'library-only.mjs')
  .filter((f) => /refuseDirectExecution\(/.test(fs.readFileSync(path.join(HERE, f), 'utf8')))

function proseFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return proseFiles(p)
    return e.name.endsWith('.md') ? [p] : []
  })
}

describe('la prosa de memory-sync no invoca una API como si fuera un CLI', () => {
  it('reconoce los módulos library-only (si esto da vacío, la prueba no mide nada)', () => {
    assert.ok(libraryOnly.includes('rollback-version.mjs'), `library-only: ${libraryOnly.join(', ')}`)
  })

  it('ninguna prosa dice `node scripts/memory-sync/<api>.mjs`', () => {
    const hits = []
    for (const dir of PROSE_DIRS) {
      for (const file of proseFiles(path.join(ROOT, dir))) {
        const text = fs.readFileSync(file, 'utf8')
        for (const mod of libraryOnly) {
          if (new RegExp(`node\\s+scripts/memory-sync/${mod.replace('.', '\\.')}`).test(text)) {
            hits.push(`${path.relative(ROOT, file)} → ${mod}`)
          }
        }
      }
    }
    assert.deepEqual(hits, [])
  })

  it('el comando de rollback de la skill corre tal cual y restaura la versión previa', async () => {
    const skill = fs.readFileSync(SKILL, 'utf8')
    const command = skill.match(/`(node [^`]*rollbackVersion[^`]*)`/)?.[1]
    assert.ok(command, 'la skill no trae un comando que importe rollbackVersion')

    const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi ws rollback-'))
    try {
      const versionsRoot = path.join(ws, '.specify/memory/versions')
      fs.cpSync(path.join(HERE, 'fixtures/valid'), versionsRoot, { recursive: true })
      fs.cpSync(HERE, path.join(ws, 'scripts/memory-sync'), { recursive: true })
      await prepareVersionManifest({
        workspace: 'fixture-workspace', versionId: 'fixture-v3', sourceWorkspace: 'source-workspace',
        sourceVersionId: 'source-v8', ownerContext: 'candidato para probar el rollback de la skill',
        decisions: { retain: ['a'], complement: ['b'], discard: ['c'] }, versionsRoot,
      })
      await activateVersion({ workspace: 'fixture-workspace', versionId: 'fixture-v3', versionsRoot })

      const r = spawnSync('bash', ['-c', command], {
        cwd: ws,
        encoding: 'utf8',
        env: { ...process.env, WORKSPACE: 'fixture-workspace', targetVersionId: 'fixture-v2', reason: 'la v3 rompió el piso' },
      })
      assert.equal(r.status, 0, r.stdout + r.stderr)
      const state = JSON.parse(fs.readFileSync(path.join(versionsRoot, 'active.json'), 'utf8')).workspaceStates['fixture-workspace']
      assert.equal(state.activeVersionId, 'fixture-v2')
      assert.equal(state.rollbackReason, 'la v3 rompió el piso')
    } finally {
      fs.rmSync(ws, { recursive: true, force: true })
    }
  })
})
