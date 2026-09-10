/**
 * test/contracts/typed-prop-fields.test.ts
 *
 * Every field a component reads off a typed prop must exist on that type.
 *
 * `TaskTanstackTable.vue` was written against `TaskItem`, a type that does not
 * exist in `shared/types.ts`, and read `featureName` and `role` — two fields
 * the registry parser never produces. Nothing caught it. The phantom import is
 * type-only, so esbuild strips it before anything could complain; `nuxt
 * typecheck` is not part of the test chain; and the file named
 * `task-tanstack-table.test.ts` never imported the component at all — it built
 * a literal array and asserted that `Array.prototype.filter` works, so it
 * passed whether or not the component existed.
 *
 * The result reached the running dashboard: the Feature column printed the
 * literal 'General' on every row, the Assigned Role column printed 'general',
 * and the role facet offered exactly one option. The sibling views, TaskBoard
 * and TaskSummaryCard, had always used the real `feature` and `owner`.
 *
 * Reading source text costs nothing at runtime and catches the whole class,
 * which is the trade this project prefers over mounting 53 components.
 */

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = join(dirname(fileURLToPath(import.meta.url)), '../..')
const TYPES = readFileSync(join(APP, 'shared/types.ts'), 'utf8')

/**
 * Fields declared by an interface in shared/types.ts, following `extends`.
 * Returns null when the name is not an interface there — a component may
 * legitimately import a zod-inferred type or one from elsewhere, and guessing
 * at those would produce false alarms.
 */
export function interfaceFields(typeName: string, source = TYPES, seen = new Set<string>()): Set<string> | null {
  if (seen.has(typeName)) return new Set()
  seen.add(typeName)

  const decl = new RegExp(`export interface ${typeName}(?:\\s+extends\\s+([A-Za-z0-9_,\\s]+))?\\s*\\{([\\s\\S]*?)\\n\\}`, 'm')
  const m = source.match(decl)
  if (!m) return null

  const fields = new Set<string>()
  for (const parent of (m[1] || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const inherited = interfaceFields(parent, source, seen)
    if (inherited) for (const f of inherited) fields.add(f)
  }
  for (const line of m[2].split('\n')) {
    const f = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\??\s*:/)
    if (f) fields.add(f[1])
  }
  return fields
}

/** The shared type a component declares its `tasks`-like prop with. */
function importedSharedType(sfc: string): string | null {
  const m = sfc.match(/import type \{\s*([A-Za-z0-9_]+)\s*\}\s*from\s*'~\/shared\/types'/)
  return m ? m[1] : null
}

/** Field names the component reads off a row of that typed collection. */
export function readFields(sfc: string): string[] {
  const found = new Set<string>()
  for (const m of sfc.matchAll(/accessorKey:\s*'([A-Za-z0-9_]+)'/g)) found.add(m[1])
  for (const m of sfc.matchAll(/row\.original\.([A-Za-z0-9_]+)/g)) found.add(m[1])
  return [...found].sort()
}

const COMPONENTS = readdirSync(join(APP, 'app/components')).filter((f) => f.endsWith('.vue'))

describe('a component never reads a field its declared type does not have', () => {
  it('finds components to check, so the gate is not vacuous', () => {
    expect(COMPONENTS.length).toBeGreaterThan(0)
  })

  for (const file of COMPONENTS) {
    const sfc = readFileSync(join(APP, 'app/components', file), 'utf8')
    const typeName = importedSharedType(sfc)
    if (!typeName) continue

    it(`${file} declares a type that exists in shared/types.ts`, () => {
      // A phantom type is the root of the failure: an import that resolves to
      // nothing still compiles, so every field read off it is unchecked.
      const known = /export (?:interface|type|const) /g
      const declared = TYPES.match(new RegExp(`export (?:interface|type) ${typeName}\\b`))
      expect(declared, `${file} importa '${typeName}' y shared/types.ts no lo declara`).not.toBeNull()
      expect(known).toBeTruthy()
    })

    const fields = interfaceFields(typeName)
    if (!fields) continue

    it(`${file} reads only fields that ${typeName} declares`, () => {
      const phantom = readFields(sfc).filter((f) => !fields.has(f))
      expect(phantom, `${file} lee campos que ${typeName} no tiene: ${phantom.join(', ')}`).toEqual([])
    })
  }
})

describe('the checker itself', () => {
  it('follows extends when collecting fields', () => {
    const fields = interfaceFields('TaskRecord')
    expect(fields?.has('feature')).toBe(true) // de RegistryTaskRow
    expect(fields?.has('artifacts')).toBe(true) // propio
  })

  it('returns null for a type it cannot resolve, instead of guessing', () => {
    expect(interfaceFields('TipoQueNoExiste')).toBeNull()
  })

  it('would have caught the shipped defect', () => {
    const before = "accessorKey: 'featureName'\nrow.original.role\n"
    const fields = interfaceFields('TaskRecord')!
    expect(readFields(before).filter((f) => !fields.has(f))).toEqual(['featureName', 'role'])
  })
})
