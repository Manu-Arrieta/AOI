import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { auditRegistrySync, formatRegistrySync, tasksInRegistry, tasksOnDisk } from './registry-sync.mjs'

/** A throwaway workspace with the given tasks on disk and in the registry. */
function workspace({ onDisk = [], registered = [] } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-reg-'))
  for (const id of onDisk) fs.mkdirSync(path.join(root, '.tasks/feat', id), { recursive: true })
  fs.mkdirSync(path.join(root, '.tasks'), { recursive: true })
  const rows = registered.map((id) => `| ${id} | feat | t | 📋 | Owner | — | — |`).join('\n')
  fs.writeFileSync(
    path.join(root, '.tasks/registry.md'),
    `# Registry\n\n| TASK-ID | Feature | Title | Status | Owner | Created | Closed |\n| :-- | :-- | :-- | :-- | :-- | :-- | :-- |\n${rows}\n`
  )
  return root
}

const clean = (root) => fs.rmSync(root, { recursive: true, force: true })

describe('the registry is held against disk', () => {
  it('agrees when both sides declare the same tasks', () => {
    const root = workspace({ onDisk: ['TASK-2026-001'], registered: ['TASK-2026-001'] })
    const a = auditRegistrySync(root)
    assert.deepEqual(a.unregistered, [])
    assert.deepEqual(a.phantom, [])
    clean(root)
  })

  it('flags a task on disk the registry never declared', () => {
    // The live-cycle finding: the registry listed zero tasks while two sat in
    // .tasks/, so /sdd-new would have handed out an id already in use.
    const root = workspace({ onDisk: ['TASK-2026-003', 'TASK-2026-101'], registered: [] })
    const a = auditRegistrySync(root)
    assert.deepEqual(a.unregistered, ['TASK-2026-003', 'TASK-2026-101'])
    clean(root)
  })

  it('flags a task the registry declares that is not on disk', () => {
    const root = workspace({ onDisk: [], registered: ['TASK-2026-007'] })
    assert.deepEqual(auditRegistrySync(root).phantom, ['TASK-2026-007'])
    clean(root)
  })

  it('takes the next id from the highest number on EITHER side', () => {
    // Reading only the registry is the bug. With 101 on disk and 003
    // registered, the next safe id is 102, not 004.
    const root = workspace({ onDisk: ['TASK-2026-101'], registered: ['TASK-2026-003'] })
    assert.match(auditRegistrySync(root).nextId, /-102$/)
    clean(root)
  })

  it('starts at 001 in an empty workspace', () => {
    const root = workspace()
    assert.match(auditRegistrySync(root).nextId, /-001$/)
    clean(root)
  })

  it('counts only directories, not a stray file named like a task', () => {
    // A mutation survived that turned `isDirectory() && matches` into an OR,
    // which would count every file in a feature folder as a task and inflate
    // the next id past every real one.
    const root = workspace()
    fs.mkdirSync(path.join(root, '.tasks/feat'), { recursive: true })
    fs.writeFileSync(path.join(root, '.tasks/feat/TASK-2026-999'), 'no soy un directorio')
    fs.mkdirSync(path.join(root, '.tasks/feat/no-es-una-tarea'), { recursive: true })

    assert.deepEqual(tasksOnDisk(root), [])
    clean(root)
  })

  it('does not mistake the column header for a task', () => {
    // `| TASK-ID | Feature | ...` is the header; counting it as a task would
    // make an empty registry look populated.
    const root = workspace()
    assert.deepEqual(tasksInRegistry(root), [])
    assert.deepEqual(tasksOnDisk(root), [])
    clean(root)
  })
})

describe('the id space has an end, and the allocator has to say so', () => {
  // `padStart(3)` does not truncate: past 999 it simply stops padding and
  // returns `TASK-2026-1000`, four digits that this module's own
  // `/^TASK-\d{4}-\d{3}$/` can never match. The directory created under that
  // name is invisible to `tasksOnDisk`, so the next run recomputes the same
  // 1000 and the collision repeats in silence, forever.
  it('refuses to hand out an id the format cannot represent', () => {
    const root = workspace({ onDisk: ['TASK-2026-999'], registered: ['TASK-2026-999'] })
    const audit = auditRegistrySync(root)
    assert.equal(audit.exhausted, true)
    assert.equal(audit.nextId, null, 'entregó un id de cuatro dígitos')
    assert.match(formatRegistrySync(audit), /AGOTADO/)
    clean(root)
  })

  it('still allocates the last representable id', () => {
    // The negative control: 998 used means 999 is free, and the gate must not
    // block a workspace that has one number left.
    const root = workspace({ onDisk: ['TASK-2026-998'], registered: ['TASK-2026-998'] })
    const audit = auditRegistrySync(root)
    assert.equal(audit.exhausted, false)
    assert.match(audit.nextId, /^TASK-\d{4}-999$/)
    clean(root)
  })

  it('sees exhaustion from the registry side too, not just from disk', () => {
    const root = workspace({ registered: ['TASK-2026-999'] })
    assert.equal(auditRegistrySync(root).exhausted, true)
    clean(root)
  })
})
