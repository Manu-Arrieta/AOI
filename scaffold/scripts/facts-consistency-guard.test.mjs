import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import {
  AUDITED_FACT_KEYS,
  checkFactsConsistency,
  collectDeclaredDependencies,
  extractPackageClaims,
  extractPathClaims,
  parseFactValue,
  unsupportedClaims,
} from './facts-consistency-guard.mjs'

/** The exact values the measured contamination carried. */
const CONTAMINATED_FRAMEWORKS = 'Nuxt 4.4.6, Vue 3.5.34, @nuxt/ui 4.9.0, Tailwind 4.3, Vitest 4.1.7'
const CONTAMINATED_PACKAGE_MANAGER = 'pnpm@11.3.0 (workspaces: aoi_apps/*)'

function fixture({ manifest, dirs = [] } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'facts-guard-'))
  if (manifest) fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(manifest))
  for (const dir of dirs) fs.mkdirSync(path.join(root, dir), { recursive: true })
  return root
}

/**
 * Stands in for `git` and `icm`, so the suite never reads the shared database.
 * @param {Record<string,string>} facts
 */
function stubExec(facts, { workspace = 'fixture-ws' } = {}) {
  return async (bin, args) => {
    if (bin === 'git') return { stdout: `https://example.com/${workspace}.git\n` }
    const key = args[3]
    if (!(key in facts)) {
      const error = new Error(`no active fact for ${workspace}.${key}`)
      throw error
    }
    return { stdout: `${facts[key]}\n  source: cli | created: 2026-09-15 14:39\n` }
  }
}

describe('facts consistency guard', () => {
  it('reads only the first line of `icm facts get`, never its provenance', () => {
    assert.equal(parseFactValue('pnpm@11.3.0\n  source: cli | id: 01M2\n'), 'pnpm@11.3.0')
    assert.equal(parseFactValue(undefined), '')
  })

  it('collects declared dependencies and ignores node_modules', () => {
    const root = fixture({ manifest: { dependencies: { nuxt: '4.4.6' }, devDependencies: { vitest: '4.1.7' } } })
    fs.mkdirSync(path.join(root, 'node_modules', 'ghost'), { recursive: true })
    fs.writeFileSync(path.join(root, 'node_modules', 'ghost', 'package.json'), JSON.stringify({ dependencies: { react: '1' } }))

    const evidence = collectDeclaredDependencies(root)

    assert.ok(evidence.dependencies.has('nuxt'))
    assert.ok(evidence.dependencies.has('vitest'))
    assert.ok(!evidence.dependencies.has('react'), 'node_modules no es evidencia del proyecto')
    assert.equal(evidence.manifestCount, 1)
  })

  it('names the verifiable packages a fact claims', () => {
    const claims = extractPackageClaims(CONTAMINATED_FRAMEWORKS).map((c) => c.token)

    assert.deepEqual(claims.sort(), ['nuxt', 'tailwind', 'vitest', 'vue'])
  })

  it('reads a workspace glob as a path but a scoped package and a URL as neither', () => {
    assert.deepEqual(extractPathClaims(CONTAMINATED_PACKAGE_MANAGER), ['aoi_apps'])
    assert.deepEqual(extractPathClaims('@nuxt/ui 4.9.0'), [])
    assert.deepEqual(extractPathClaims('docs at https://example.com/foo'), [])
  })

  it('refutes the claims of the measured contamination', () => {
    // The regression this guard exists for: a tree of plain .mjs with an empty
    // manifest, described by facts belonging to another repository.
    const root = fixture({ manifest: { name: 'aoi-workspace', private: true } })
    const evidence = collectDeclaredDependencies(root)

    const frameworks = unsupportedClaims('stack.frameworks', CONTAMINATED_FRAMEWORKS, evidence, root)
    const manager = unsupportedClaims('stack.packageManager', CONTAMINATED_PACKAGE_MANAGER, evidence, root)

    assert.ok(frameworks.some((f) => f.includes('nuxt')))
    assert.ok(frameworks.some((f) => f.includes('tailwindcss')))
    assert.ok(!frameworks.some((f) => f.includes('nuxt/ui')), 'un paquete con scope no es una ruta faltante')
    assert.deepEqual(manager.length, 1)
    assert.ok(manager[0].includes('aoi_apps'))
  })

  it('stays quiet about packages when no manifest exists to judge them', () => {
    // A Python or Go tree declares nothing this guard can read. Absence of
    // evidence is not evidence of a wrong fact.
    const root = fixture()
    const evidence = collectDeclaredDependencies(root)

    assert.deepEqual(unsupportedClaims('stack.frameworks', 'Django, FastAPI, React', evidence, root), [])
  })

  it('corroborates a fact the tree actually supports', () => {
    const root = fixture({ manifest: { dependencies: { nuxt: '4.4.6', vue: '3.5.34' } } })
    const evidence = collectDeclaredDependencies(root)

    assert.deepEqual(unsupportedClaims('stack.frameworks', 'Nuxt 4.4.6, Vue 3.5.34', evidence, root), [])
  })

  it('warns, never fails, when the tree refutes the stored facts', async () => {
    const root = fixture({ manifest: { name: 'aoi-workspace' } })

    const result = await checkFactsConsistency(
      root,
      stubExec({
        'stack.frameworks': CONTAMINATED_FRAMEWORKS,
        'stack.packageManager': CONTAMINATED_PACKAGE_MANAGER,
      }),
    )

    assert.equal(result.status, 'WARNING')
    assert.notEqual(result.status, 'FAILED')
    assert.ok(result.findings.length >= 2)
    assert.ok(result.details.includes('icm facts set'), 'el reporte tiene que nombrar el arreglo')
  })

  it('passes when every stored fact matches the tree', async () => {
    const root = fixture({ manifest: { dependencies: { nuxt: '4.4.6' } } })

    const result = await checkFactsConsistency(root, stubExec({ 'stack.frameworks': 'Nuxt 4.4.6' }))

    assert.equal(result.status, 'PASSED')
    assert.deepEqual(result.findings, [])
  })

  it('passes and says so when the workspace has no stack facts yet', async () => {
    const root = fixture({ manifest: { name: 'fresh' } })

    const result = await checkFactsConsistency(root, stubExec({}))

    assert.equal(result.status, 'PASSED')
    assert.ok(result.details.includes('/init'))
  })

  it('audits the facts that name things a tree can confirm', () => {
    assert.deepEqual(AUDITED_FACT_KEYS, ['stack.frameworks', 'stack.packageManager', 'baseProject.map'])
  })
})

// `baseProject.map` was added after an installed workspace carried it through
// six consecutive `/init` runs asserting it had written
// `.specify/memory/base-project.json` — with a byte count and the phrase
// "verified on disk by ls" — while the file was absent every time. The writer
// works; nothing regenerates the file and nothing noticed it had gone.
//
// Adding the key was NOT enough, and that is the point of these cases. The old
// `PATH_CLAIM` matched exactly two segments, so the claim above yielded
// `.specify/memory` — a directory that DOES exist. The guard would have passed
// on the very fact that motivated it: a gate that appears to cover a path and
// does not is worse than one that admits it never looked.
describe('a fact that names a file, not just its directory', () => {
  it('reads the whole path, so the file is what gets checked', () => {
    assert.deepEqual(
      extractPathClaims('written to .specify/memory/base-project.json (235 bytes, verified on disk by ls)'),
      ['.specify/memory/base-project.json'],
    )
  })

  it('reports the absent file even though its directory is there', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-facts-path-'))
    fs.mkdirSync(path.join(root, '.specify', 'memory'), { recursive: true })

    const found = unsupportedClaims(
      'baseProject.map',
      'written to .specify/memory/base-project.json, verified on disk by ls',
      { dependencies: new Set(), manifestCount: 0 },
      root,
    )

    assert.deepEqual(found, ['baseProject.map nombra la ruta ".specify/memory/base-project.json/" que no existe en el árbol'])
    fs.rmSync(root, { recursive: true, force: true })
  })

  // Negative control: the same claim over a tree that really holds the file
  // must stay silent, or the guard is just noise that gets muted.
  it('stays silent when the file is actually there', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-facts-path-'))
    fs.mkdirSync(path.join(root, '.specify', 'memory'), { recursive: true })
    fs.writeFileSync(path.join(root, '.specify', 'memory', 'base-project.json'), '{}')

    const found = unsupportedClaims(
      'baseProject.map',
      'written to .specify/memory/base-project.json, verified on disk by ls',
      { dependencies: new Set(), manifestCount: 0 },
      root,
    )

    assert.deepEqual(found, [])
    fs.rmSync(root, { recursive: true, force: true })
  })

  // The glob form must keep behaving as before: this is what caught
  // `workspaces: aoi_apps/*` over a tree with no `aoi_apps/`.
  it('still strips a glob suffix to the directory it names', () => {
    assert.deepEqual(extractPathClaims('pnpm@11.3.0 (workspaces: aoi_apps/*)'), ['aoi_apps'])
  })

  // And a scoped package must still not be read as a folder, or the guard
  // drowns in noise and stops being read.
  it('still refuses to read a scoped package as a directory', () => {
    assert.deepEqual(extractPathClaims('Nuxt 4.4.6, @nuxt/ui 4.9.0'), [])
  })
})
