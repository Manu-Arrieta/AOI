import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { AREA_OWNERSHIP, discoverAreas, isDevelopmentRepo, renderProjectGuide } from './claude-project-guide.mjs'

/**
 * Builds a throwaway tree with the given area directories under `scripts/`.
 * @param {string[]} areas
 * @returns {string} the fixture root
 */
function fixtureWithAreas(areas) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guide-areas-'))
  for (const area of areas) fs.mkdirSync(path.join(root, 'scripts', area), { recursive: true })
  return root
}

describe('claude-project-guide area table', () => {
  it('discovers the areas that exist, ignoring node_modules and dot-directories', () => {
    const root = fixtureWithAreas(['sandbox', 'code-lens', 'node_modules', '.cache'])

    assert.deepEqual(discoverAreas(root), ['code-lens', 'sandbox'])
  })

  it('returns no areas when the tree carries no scripts/ at all', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guide-empty-'))

    assert.deepEqual(discoverAreas(root), [])
    assert.ok(renderProjectGuide({ repoRoot: root }).includes('carries no AOI runtime'))
  })

  it('omits an area the installation did not receive', () => {
    // The measured regression: a `core` install has no `scripts/conf/`, yet the
    // hardcoded table named it, sending every agent after a directory that was
    // deliberately not shipped.
    const root = fixtureWithAreas(['sandbox', 'scaffold'])

    const guide = renderProjectGuide({ repoRoot: root })

    assert.ok(guide.includes('| `sandbox/` |'))
    assert.ok(!guide.includes('| `conf/` |'))
    assert.ok(guide.includes('2 areas under `scripts/`'))
  })

  it('counts exactly the rows it emits', () => {
    const root = fixtureWithAreas(['sandbox', 'scaffold', 'code-lens'])

    const guide = renderProjectGuide({ repoRoot: root })
    const rows = guide.split('\n').filter((line) => /^\| `[^`]+\/` \|/.test(line))

    assert.equal(rows.length, 3)
    assert.ok(guide.includes('3 areas under `scripts/`'))
  })

  it('flags an area nobody described instead of hiding it', () => {
    // Dropping the row would reintroduce the same defect mirrored: a real area
    // invisible because a literal was never updated.
    const root = fixtureWithAreas(['sandbox', 'brand-new-area'])

    const guide = renderProjectGuide({ repoRoot: root })

    assert.ok(guide.includes('| `brand-new-area/` |'))
    assert.ok(guide.includes('AREA_OWNERSHIP'))
  })

  it('describes every area this repository actually ships', () => {
    const repoRoot = path.resolve(import.meta.dirname, '..', '..')
    const undescribed = discoverAreas(repoRoot).filter((area) => !(area in AREA_OWNERSHIP))

    assert.deepEqual(undescribed, [], `sin descripción en AREA_OWNERSHIP: ${undescribed.join(', ')}`)
  })

  it('describes the areas only the INSTALLER creates, which this tree never has', (t) => {
    // The assertion above used to carry the comment "the only tree where all
    // areas exist". It is not: setup.sh writes `scripts/bin/aoi-copilot` into
    // every workspace it installs, and this repository has no `bin/` for
    // discoverAreas to find. So `bin` went undescribed here and the compiled
    // guide shipped "(undescribed — add it to AREA_OWNERSHIP)" to every
    // installation, where the assertion above then failed on a tree the
    // development repo could not reproduce.
    //
    // Reading setup.sh closes that blind spot at the source: an area the
    // installer starts creating tomorrow fails here, upstream, on the commit
    // that adds it — instead of downstream, on someone else's workspace.
    const repoRoot = path.resolve(import.meta.dirname, '..', '..')

    // Only the source repository has an installer to read. Asserting here
    // unconditionally is the very mistake this test exists to prevent — the
    // first draft did exactly that and died with ENOENT on setup.sh in an
    // installed workspace, one screen after being written to stop tests from
    // assuming the development tree.
    if (!isDevelopmentRepo(repoRoot)) {
      t.skip('sin setup.sh: una instalación no tiene instalador que leer')
      return
    }

    const installer = fs.readFileSync(path.join(repoRoot, 'setup.sh'), 'utf8')

    const created = [...installer.matchAll(/\$PROJECT_PATH\/scripts\/([A-Za-z0-9._-]+)/g)]
      .map((m) => m[1])
      .filter((entry) => !entry.includes('.'))

    assert.ok(created.includes('bin'), 'el instalador dejó de crear scripts/bin — actualizá esta aserción')

    const undescribed = [...new Set(created)].filter((area) => !(area in AREA_OWNERSHIP))
    assert.deepEqual(undescribed, [], `el instalador crea scripts/${undescribed.join(', ')} y AREA_OWNERSHIP no lo describe`)
  })

  it('reads the development-repository marker from the tree', () => {
    const root = fixtureWithAreas(['sandbox'])
    assert.equal(isDevelopmentRepo(root), false)

    fs.writeFileSync(path.join(root, 'setup.sh'), '#!/usr/bin/env bash\n')
    assert.equal(isDevelopmentRepo(root), true)
  })
})
