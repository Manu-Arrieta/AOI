import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const APP_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const SERVER_ROOT = join(APP_ROOT, 'server')

/** Every `from '<specifier>'` in a static import or re-export. */
const STATIC_SPECIFIER = /(?:^|\n)\s*(?:import|export)[^'"\n]*?from\s*['"]([^'"]+)['"]/g

function typescriptFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return typescriptFiles(full)
    return full.endsWith('.ts') ? [full] : []
  })
}

describe('server static imports', () => {
  /**
   * A static relative import that leaves the Nuxt app is a boot-time crash the
   * route tests cannot see. Vitest resolves the specifier against the file that
   * wrote it, so it reads fine here; Nitro externalises it and lets Rollup
   * re-anchor the relative path against the virtual chunk id, which added six
   * levels to `../../../../scripts/aoi-doctor.mjs` and normalised the result to
   * `/scripts/aoi-doctor.mjs`. The dashboard failed to start, green suite and
   * all. Anything outside the app is loaded at runtime instead — see
   * server/utils/load-aoi-module.ts.
   */
  it('never reach outside the app', () => {
    const escaping: string[] = []

    for (const file of typescriptFiles(SERVER_ROOT)) {
      const source = readFileSync(file, 'utf8')
      for (const [, specifier] of source.matchAll(STATIC_SPECIFIER)) {
        if (!specifier.startsWith('.')) continue
        const target = resolve(dirname(file), specifier)
        if (relative(APP_ROOT, target).startsWith('..')) {
          escaping.push(`${relative(APP_ROOT, file)} -> ${specifier}`)
        }
      }
    }

    expect(escaping).toEqual([])
  })
})
