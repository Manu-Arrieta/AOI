#!/usr/bin/env node
/**
 * scripts/sdd-lifecycle/registry-sync.mjs
 *
 * Holds `.tasks/registry.md` against what is actually on disk.
 *
 * `/sdd-new` step 3 tells the agent: "Read `.tasks/registry.md` for the last
 * TASK-ID used", then generate the next sequential number. A live cycle showed
 * what happens when the registry is not kept in sync: it listed **zero** tasks
 * while `TASK-2026-003` and `TASK-2026-101` sat in `.tasks/`. An agent
 * following the prompt faithfully reads an empty table, concludes the next id
 * is `TASK-2026-001`, and collides with work that already exists.
 *
 * The same shape produced a second collision in that run. `/sdd-frame` says a
 * BIC id is "sequential" without saying what to count, and a real agent — with
 * the instruction in front of it — overwrote an existing `BIC-2026-001`.
 *
 * An id allocator whose source of truth drifts from reality does not fail
 * loudly; it hands out numbers that are already taken. So this compares the
 * two and refuses to let them disagree.
 *
 * Filesystem arithmetic: 0 inference tokens.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TASK_ID = /TASK-\d{4}-\d{3}/g

/** Task directories that exist under `.tasks/<feature>/<TASK-ID>`. */
export function tasksOnDisk(root) {
  const tasksRoot = path.join(root, '.tasks')
  if (!fs.existsSync(tasksRoot)) return []

  const found = []
  for (const feature of fs.readdirSync(tasksRoot, { withFileTypes: true })) {
    if (!feature.isDirectory()) continue
    const featureDir = path.join(tasksRoot, feature.name)
    for (const task of fs.readdirSync(featureDir, { withFileTypes: true })) {
      if (task.isDirectory() && /^TASK-\d{4}-\d{3}$/.test(task.name)) {
        found.push({ id: task.name, feature: feature.name })
      }
    }
  }
  return found.sort((a, b) => a.id.localeCompare(b.id))
}

/** Task ids the registry table declares. */
export function tasksInRegistry(root) {
  const file = path.join(root, '.tasks/registry.md')
  if (!fs.existsSync(file)) return []

  const ids = new Set()
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    // Only table rows: the legend and the header name the column, not a task.
    if (!line.trim().startsWith('|')) continue
    for (const m of line.matchAll(TASK_ID)) ids.add(m[0])
  }
  return [...ids].sort()
}

/**
 * Compares both sides.
 *
 * @returns {{ onDisk: string[], inRegistry: string[], unregistered: string[],
 *   phantom: string[], nextId: string }}
 */
export function auditRegistrySync(root) {
  const disk = tasksOnDisk(root)
  const diskIds = disk.map((t) => t.id)
  const registryIds = tasksInRegistry(root)

  const unregistered = diskIds.filter((id) => !registryIds.includes(id))
  const phantom = registryIds.filter((id) => !diskIds.includes(id))

  // The next id must clear BOTH sides. Taking it from the registry alone is
  // exactly the bug: the highest number that exists anywhere is the floor.
  const all = [...new Set([...diskIds, ...registryIds])]
  const year = new Date().getFullYear()
  const highest = all
    .map((id) => Number(id.slice(-3)))
    .reduce((max, n) => (Number.isFinite(n) && n > max ? n : max), 0)
  const nextId = `TASK-${year}-${String(highest + 1).padStart(3, '0')}`

  return { onDisk: diskIds, inRegistry: registryIds, unregistered, phantom, nextId }
}

/** One line per discrepancy, for a report. */
export function formatRegistrySync(audit) {
  const lines = [
    `En disco:    ${audit.onDisk.length} tarea(s)`,
    `En registry: ${audit.inRegistry.length} tarea(s)`,
    `Próximo id seguro: ${audit.nextId}`,
  ]
  for (const id of audit.unregistered) lines.push(`  ❌ ${id} existe en disco y el registry no lo declara`)
  for (const id of audit.phantom) lines.push(`  ❌ ${id} lo declara el registry y no existe en disco`)
  return lines.join('\n')
}

function main() {
  const root = process.cwd()
  const audit = auditRegistrySync(root)

  console.log('=== AOI Task Registry Sync ===\n')
  console.log(formatRegistrySync(audit))

  if (audit.unregistered.length > 0 || audit.phantom.length > 0) {
    console.error('\nEl registry es la fuente que /sdd-new consulta para asignar el próximo id.')
    console.error('Desincronizado, entrega números que ya están tomados y la colisión es silenciosa.')
    process.exit(1)
  }
  console.log('\n✅ El registry y el disco declaran las mismas tareas.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
