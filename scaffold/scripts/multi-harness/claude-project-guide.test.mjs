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

describe('claude-project-guide only states what is true where it is compiled', () => {
  it('keeps the scaffold mirror and test:parity out of an installed workspace', () => {
    // Medido en una instalación real: el CLAUDE.md instalado decía que
    // `aoi:sync-rules` refresca un `scaffold/` que el instalador no deja y que
    // `test:parity` rechaza drift, cuando allí sale 0 sin comparar nada.
    const installed = renderProjectGuide({ repoRoot: fixtureWithAreas(['sandbox']) })
    const devRoot = fixtureWithAreas(['sandbox'])
    fs.writeFileSync(path.join(devRoot, 'setup.sh'), '#!/usr/bin/env bash\n')
    const dev = renderProjectGuide({ repoRoot: devRoot })

    for (const claim of ['`test:parity`', 'refreshes the `scaffold/` mirror', 'mirroring it into `scaffold/`', 'mirrored under `scaffold/`']) {
      assert.ok(!installed.includes(claim), `el workspace instalado afirma: ${claim}`)
    }
    for (const claim of ['`test:parity`', 'refreshes the `scaffold/` mirror', 'mirroring it into `scaffold/`']) {
      assert.ok(dev.includes(claim), `el repo de desarrollo perdió: ${claim}`)
    }
    assert.ok(installed.includes('edit the generator in the AOI development repository'))
  })

  it('carries no file count, which went stale on the first install', () => {
    // "`.md` files count 60 without them and 1356 with": en una instalación
    // eran 1 y 235. Una cuenta escrita en prosa es falsa en todo árbol menos uno.
    const guide = renderProjectGuide({ repoRoot: fixtureWithAreas(['sandbox']) })
    assert.doesNotMatch(guide, /count \d+ without/)
  })

  it('recommends the cheap mode of every lens and search it names', () => {
    // Se carga en cada turno. Medido: `aoi:graph` 38 KB contra 465 B con
    // `--hubs`, `aoi:determinism` 32 KB contra 109 B con `--summary`, y
    // `fd -H -I` 1367 `.md` de los cuales 973 eran de node_modules.
    const guide = renderProjectGuide({ repoRoot: path.resolve(import.meta.dirname, '..', '..') })
    const cheap = [
      [/pnpm aoi:graph(?! --hubs)/, 'aoi:graph sin --hubs'],
      [/pnpm aoi:determinism(?! --summary)/, 'aoi:determinism sin --summary'],
      [/fd -H -I(?! -E node_modules)/, 'fd -H -I sin -E node_modules'],
      [/rg --no-ignore(?! -g '!node_modules')/, "rg --no-ignore sin -g '!node_modules'"],
    ]
    for (const [expensive, label] of cheap) assert.doesNotMatch(guide, expensive, label)
  })

  it('does not claim compile-rules ignores unknown flags, which exit 2', () => {
    const guide = renderProjectGuide({ workspace: 'ws one', repoRoot: fixtureWithAreas(['sandbox']) })
    assert.doesNotMatch(guide, /fall back\s+to defaults silently/)
    assert.ok(guide.includes('`--workspace "ws one"`'), 'el workspace con espacio llega sin comillas')
  })
})

describe('the compiled harness files have a single writer', () => {
  it('no agent or prompt runs spec-kit\'s agent-context updater', () => {
    // `speckit.plan` corría `update-agent-context.sh copilot`. Medido: le agregó
    // 104 B ("Active Technologies") a `.github/copilot-instructions.md`, que
    // compila `aoi:sync-rules`: el prefijo cacheado cambia a mitad de ciclo y el
    // siguiente sync lo vuelve a 2558 B. Lo que agregaba ya está en el
    // Technical Context del plan, que tasks e implement leen.
    const repoRoot = path.resolve(import.meta.dirname, '..', '..')
    const offenders = []
    for (const dir of ['.github/agents', '.github/prompts']) {
      const abs = path.join(repoRoot, dir)
      if (!fs.existsSync(abs)) continue
      for (const name of fs.readdirSync(abs).filter((n) => n.endsWith('.md'))) {
        const text = fs.readFileSync(path.join(abs, name), 'utf8')
        if (/update-agent-context|update-context\.(sh|ps1)/.test(text)) offenders.push(`${dir}/${name}`)
      }
    }
    assert.deepEqual(offenders, [], `reescriben un archivo compilado: ${offenders.join(', ')}`)
  })
})
