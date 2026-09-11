/**
 * scripts/sdd-lifecycle/phase-cli-surface.test.mjs
 *
 * The command line of the phase plumbing: linking resources to a task,
 * holding the registry against disk, assembling a phase's context and
 * auditing the handoff chain. Each decides something with an exit code and
 * none of those exits had a test.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '../..')
const LINK = path.join(HERE, 'link-resources.mjs')
const REGISTRY = path.join(HERE, 'registry-sync.mjs')
const ASSEMBLE = path.join(HERE, 'assemble-phase-context.mjs')
const HANDOFFS = path.join(HERE, 'phase-handoffs.mjs')

/** Runs a CLI and returns its exit code, stdout and stderr, never through a pipe. */
function run(script, args, cwd = HERE) {
  try {
    const stdout = execFileSync('node', [script, ...args], {
      cwd,
      encoding: 'utf8',
      timeout: 60000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, stdout, stderr: '' }
  } catch (e) {
    return { code: e.status ?? 1, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') }
  }
}

describe('link-resources refuses to guess where the task lives', () => {
  it('exits 1 and prints usage without --task-dir', () => {
    const r = run(LINK, [])
    assert.equal(r.code, 1)
    assert.match(r.stderr, /Usage:/)
  })

  it('exits 0 and writes relations.json for a real task directory', () => {
    // Resource paths are resolved against `.resources/`, so the link is
    // recorded as a workspace-relative reference rather than an absolute one
    // — that is what lets relations.json survive being moved or shared.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-link-'))
    const taskDir = path.join(root, '.tasks/feat/TASK-2026-001')
    fs.mkdirSync(taskDir, { recursive: true })
    fs.mkdirSync(path.join(root, '.resources/userstories'), { recursive: true })
    fs.writeFileSync(path.join(root, '.resources/userstories/historia.md'), '# historia\n')

    const r = run(LINK, ['--task-dir', taskDir, '--story', 'userstories/historia.md'], root)
    assert.equal(r.code, 0, `${r.stdout}${r.stderr}`)
    const relations = JSON.parse(fs.readFileSync(path.join(taskDir, 'relations.json'), 'utf8'))
    assert.deepEqual(relations.userstories, ['.resources/userstories/historia.md'])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('refuses a resource that does not exist instead of recording a dangling link', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-link2-'))
    const taskDir = path.join(root, '.tasks/feat/TASK-2026-001')
    fs.mkdirSync(taskDir, { recursive: true })
    fs.mkdirSync(path.join(root, '.resources/userstories'), { recursive: true })

    const r = run(LINK, ['--task-dir', taskDir, '--story', 'userstories/fantasma.md'], root)
    assert.equal(r.code, 1)
    assert.equal(fs.existsSync(path.join(taskDir, 'relations.json')), false)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('refuses a user story filed under the workflows prefix', () => {
    // The prefix check is what keeps the two buckets meaningful; without it
    // relations.json would claim a story that is actually a workflow.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-link3-'))
    const taskDir = path.join(root, '.tasks/feat/TASK-2026-001')
    fs.mkdirSync(taskDir, { recursive: true })
    fs.mkdirSync(path.join(root, '.resources/workflows'), { recursive: true })
    fs.writeFileSync(path.join(root, '.resources/workflows/flujo.md'), '# flujo\n')

    const r = run(LINK, ['--task-dir', taskDir, '--story', 'workflows/flujo.md'], root)
    assert.equal(r.code, 1)
    assert.match(r.stderr, /does not belong/)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('exits 1 rather than half-writing when the task directory does not exist', () => {
    const r = run(LINK, ['--task-dir', '/no/existe/TASK-2026-001'])
    assert.equal(r.code, 1)
    assert.match(r.stderr, /Error/)
  })
})

describe('registry-sync gates the id allocator', () => {
  /** A workspace whose registry and disk can be made to disagree. */
  function workspace({ onDisk = [], registered = [] } = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-regcli-'))
    for (const id of onDisk) fs.mkdirSync(path.join(root, '.tasks/feat', id), { recursive: true })
    fs.mkdirSync(path.join(root, '.tasks'), { recursive: true })
    const rows = registered.map((id) => `| ${id} | feat | t | 📋 | Owner | — | — |`).join('\n')
    fs.writeFileSync(
      path.join(root, '.tasks/registry.md'),
      `# Registry\n\n| TASK-ID | Feature |\n| :-- | :-- |\n${rows}\n`
    )
    return root
  }

  it('exits 0 when disk and registry agree', () => {
    const root = workspace({ onDisk: ['TASK-2026-001'], registered: ['TASK-2026-001'] })
    const r = run(REGISTRY, [], root)
    assert.equal(r.code, 0)
    assert.match(r.stdout, /Próximo id seguro: TASK-\d{4}-002/)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('exits 1 on a task that exists on disk and the registry never declared', () => {
    // Desynchronised, the allocator hands out numbers already taken and the
    // collision is silent — that is the whole reason this gate exists.
    const root = workspace({ onDisk: ['TASK-2026-003'] })
    assert.equal(run(REGISTRY, [], root).code, 1)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('exits 1 on a phantom the registry declares and disk does not have', () => {
    const root = workspace({ registered: ['TASK-2026-009'] })
    assert.equal(run(REGISTRY, [], root).code, 1)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('exits 1 when the three-digit id space is exhausted', () => {
    const root = workspace({ onDisk: ['TASK-2026-999'], registered: ['TASK-2026-999'] })
    const r = run(REGISTRY, [], root)
    assert.equal(r.code, 1)
    assert.match(r.stdout, /AGOTADO/)
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('assemble-phase-context names an unknown phase instead of assembling nothing', () => {
  it('exits 2 on a phase that does not exist', () => {
    // Exit 2, not 1: an unknown phase is a caller mistake, and answering with
    // an empty context would look exactly like a phase that needs no files.
    const r = run(ASSEMBLE, ['Phase_99_Inventada'], REPO_ROOT)
    assert.equal(r.code, 2)
    assert.match(r.stderr, /Unknown phase/)
  })

  it('exits 0 and reports a token count for every real phase', () => {
    const r = run(ASSEMBLE, [], REPO_ROOT)
    assert.equal(r.code, 0)
    const lines = r.stdout.trim().split('\n').filter(Boolean)
    assert.ok(lines.length >= 6, `esperaba una línea por fase, hubo ${lines.length}`)
    for (const line of lines) assert.match(line, /: \d+ tokens from \d+ file\(s\)/)
  })
})

describe('phase-handoffs', () => {
  it('exits 0 on the real repository, where every handoff resolves', () => {
    assert.equal(run(HANDOFFS, [], REPO_ROOT).code, 0)
  })

  it('exits 1 where no phase artifact exists at all', () => {
    // The chain cannot resolve in an empty directory, and saying so is the
    // point: a handoff audit that passes over nothing certifies nothing.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-handoff-'))
    assert.notEqual(run(HANDOFFS, [], root).code, 0)
    fs.rmSync(root, { recursive: true, force: true })
  })
})
