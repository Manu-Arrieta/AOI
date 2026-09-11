/**
 * scripts/doctor-state-checks.test.mjs
 *
 * The four checks that read the workspace itself: the task registry, memory
 * governance, the `.resources/` subtree and the harness adapters. Split from
 * `doctor-checks.test.mjs` when it crossed the 300-LOC limit — the tooling
 * checks ask about the machine, these ask about the project.
 *
 * Writing them found a real defect: the Tasks-section extraction used `\Z`,
 * which is Perl and Python. JavaScript has no such escape, so it matched a
 * literal "Z" and the section never terminated when `## Tasks` was last —
 * the normal shape. The scan then silently fell back to the whole document
 * and counted rows from every other section as tasks.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  checkMemoryGovernance,
  checkMultiHarnessRules,
  checkResourcesStructure,
  checkTaskRegistry,
} from './doctor-checks.mjs'

/** A throwaway workspace with the given files and directories. */
function tree(entries = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-state-'))
  for (const [rel, body] of Object.entries(entries)) {
    const full = path.join(root, rel)
    if (body === null) {
      fs.mkdirSync(full, { recursive: true })
      continue
    }
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, body)
  }
  return root
}

const clean = (root) => fs.rmSync(root, { recursive: true, force: true })

describe('checkTaskRegistry counts tasks and not table furniture', () => {
  const registry = (rows) =>
    `# Registry\n\n| TASK-ID | Feature | Title |\n| :-- | :-- | :-- |\n${rows}\n`

  it('FAILS when the registry file is missing', () => {
    const root = tree({})
    const r = checkTaskRegistry(root)
    assert.equal(r.status, 'FAILED')
    assert.equal(r.taskCount, 0)
    clean(root)
  })

  it('passes when every declared task has its folder', () => {
    const root = tree({
      '.tasks/registry.md': registry('| TASK-2026-001 | pagos | x |'),
      '.tasks/pagos/TASK-2026-001': null,
    })
    const r = checkTaskRegistry(root)
    assert.equal(r.status, 'PASSED')
    assert.equal(r.taskCount, 1)
    clean(root)
  })

  it('FAILS on a task the registry declares and disk does not have', () => {
    const root = tree({ '.tasks/registry.md': registry('| TASK-2026-001 | pagos | x |') })
    const r = checkTaskRegistry(root)
    assert.equal(r.status, 'FAILED')
    assert.equal(r.issues.length, 1)
    assert.match(r.issues[0], /TASK-2026-001/)
    clean(root)
  })

  it('does not count the header row or the separator as tasks', () => {
    // Both start with `|`. Counting them would report two phantom tasks in
    // every workspace and then fail looking for their folders.
    const root = tree({ '.tasks/registry.md': registry('') })
    const r = checkTaskRegistry(root)
    assert.equal(r.taskCount, 0)
    assert.equal(r.status, 'PASSED')
    clean(root)
  })

  it('ignores a row whose first cell is not a task id', () => {
    const root = tree({ '.tasks/registry.md': registry('| nota suelta | pagos | x |') })
    assert.equal(checkTaskRegistry(root).taskCount, 0)
    clean(root)
  })

  it('reads only the Tasks section when the registry has several', () => {
    const root = tree({
      '.tasks/registry.md':
        '# Registry\n\n## Archivadas\n\n| TASK-2026-900 | vieja | x |\n\n## Tasks\n\n| TASK-2026-001 | pagos | x |\n',
      '.tasks/pagos/TASK-2026-001': null,
    })
    const r = checkTaskRegistry(root)
    assert.equal(r.taskCount, 1, 'contó tareas fuera de la sección Tasks')
    assert.equal(r.status, 'PASSED')
    clean(root)
  })
})

describe('checkMemoryGovernance follows the active version to disk', () => {
  const active = (states) => JSON.stringify({ formatVersion: 1, workspaceStates: states })

  it('FAILS when active.json is missing', () => {
    const root = tree({})
    assert.equal(checkMemoryGovernance(root).status, 'FAILED')
    clean(root)
  })

  it('FAILS on an active.json that does not parse, naming the reason', () => {
    const root = tree({ '.specify/memory/versions/active.json': 'no soy json' })
    const r = checkMemoryGovernance(root)
    assert.equal(r.status, 'FAILED')
    assert.match(r.details, /Invalid active\.json/)
    clean(root)
  })

  it('passes with no workspaces declared at all', () => {
    const root = tree({ '.specify/memory/versions/active.json': active({}) })
    const r = checkMemoryGovernance(root)
    assert.equal(r.status, 'PASSED')
    assert.equal(r.workspaces, 0)
    clean(root)
  })

  it('FAILS when the active version has no manifest on disk', () => {
    // The dangling pointer is the failure worth catching: the workspace
    // believes it is running a version that does not exist.
    const root = tree({ '.specify/memory/versions/active.json': active({ ws: { activeVersionId: 'v1' } }) })
    const r = checkMemoryGovernance(root)
    assert.equal(r.status, 'FAILED')
    assert.match(r.issues[0], /v1/)
    clean(root)
  })

  it('passes when the manifest is there', () => {
    const root = tree({
      '.specify/memory/versions/active.json': active({ ws: { activeVersionId: 'v1' } }),
      '.specify/memory/versions/manifests/ws/v1.json': '{}',
    })
    assert.equal(checkMemoryGovernance(root).status, 'PASSED')
    clean(root)
  })

  it('does not chase a workspace that declares no active version', () => {
    const root = tree({ '.specify/memory/versions/active.json': active({ ws: { previousVersionId: 'v0' } }) })
    assert.equal(checkMemoryGovernance(root).status, 'PASSED')
    clean(root)
  })
})

describe('checkResourcesStructure warns, and never blocks', () => {
  // `.resources/` is optional by design, so every verdict here is PASSED or
  // WARNING. A FAILED would make an optional subtree block a workspace.
  it('warns when the folder does not exist', () => {
    const root = tree({})
    assert.equal(checkResourcesStructure(root).status, 'WARNING')
    clean(root)
  })

  it('passes on the complete subtree', () => {
    const root = tree({
      '.resources/constitution.md': '# c\n',
      '.resources/userstories': null,
      '.resources/workflows': null,
    })
    assert.equal(checkResourcesStructure(root).status, 'PASSED')
    clean(root)
  })

  const PARTIALS = [
    ['sin constitución', { '.resources/userstories': null, '.resources/workflows': null }, /constitution\.md/],
    ['sin userstories', { '.resources/constitution.md': '# c\n', '.resources/workflows': null }, /userstories/],
    ['sin workflows', { '.resources/constitution.md': '# c\n', '.resources/userstories': null }, /workflows/],
  ]
  for (const [what, entries, pattern] of PARTIALS) {
    it(`warns and names what is missing: ${what}`, () => {
      const root = tree(entries)
      const r = checkResourcesStructure(root)
      assert.equal(r.status, 'WARNING')
      assert.match(r.details, pattern)
      clean(root)
    })
  }
})

describe('checkMultiHarnessRules counts the adapters that exist', () => {
  it('warns when no harness adapter is present', () => {
    const root = tree({})
    const r = checkMultiHarnessRules(root)
    assert.equal(r.status, 'WARNING')
    assert.match(r.details, /aoi:sync-rules/)
    clean(root)
  })

  it('passes with a single adapter and names it', () => {
    const root = tree({ 'CLAUDE.md': '# x\n' })
    const r = checkMultiHarnessRules(root)
    assert.equal(r.status, 'PASSED')
    assert.match(r.details, /Claude/)
    clean(root)
  })

  it('counts each adapter once and names them all', () => {
    const root = tree({ 'CLAUDE.md': '#\n', '.cursorrules': '#\n', 'AGENTS.md': '#\n' })
    const r = checkMultiHarnessRules(root)
    assert.match(r.details, /3 harness adapter/)
    for (const name of ['Claude', 'Cursor', 'Antigravity']) assert.match(r.details, new RegExp(name))
    clean(root)
  })
})
