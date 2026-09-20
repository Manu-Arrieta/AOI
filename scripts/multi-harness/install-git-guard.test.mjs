import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, describe, it } from 'node:test'
import { GUARD_RELATIVE, auditGitGuard, installGitGuard, isInstalledWorkspace, readHooksPath } from './install-git-guard.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * Every throwaway tree this file has made, so the end-of-file sweep can remove
 * any that survived.
 *
 * Los tests llaman a `clean()` en su camino feliz, y eso alcanza mientras todo
 * pase. Una aserción que falla se lleva el `clean()` puesto: el `fs.rmSync`
 * nunca corre y el directorio queda. Medido antes de este arreglo: **+1 por
 * corrida durante 20 corridas**, más rápido de lo que un test individual se
 * lee. Y un caso creaba el workspace dentro de la aserción, así que ni
 * siquiera tenía un `clean()` que perder.
 *
 * Parchear el sitio que se olvidó habría arreglado el síntoma de hoy y ninguno
 * de mañana, porque el olvido es la forma del bug, no su instancia. La lista
 * más el barrido del final es la red que no depende de que cada test se
 * acuerde — la misma tercera capa que `mutation-probe.mjs` usa para las copias
 * que un `SIGKILL` deja atrás.
 */
const created = []

/**
 * A throwaway tree. `git: true` gives it a `.git` directory (the hook only
 * exists inside a repository), `guard: true` installs an executable guard.
 */
function workspace({ git = true, guard = true, files = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-gitguard-'))
  created.push(root)
  if (git) fs.mkdirSync(path.join(root, '.git', 'hooks'), { recursive: true })
  if (guard) {
    const full = path.join(root, GUARD_RELATIVE)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, '#!/usr/bin/env bash\nexit 0\n')
    fs.chmodSync(full, 0o755)
  }
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, body)
  }
  return root
}

const clean = (root) => fs.rmSync(root, { recursive: true, force: true })

// La red: se lleva lo que los tests limpiaron y también lo que no pudieron.
// `force` hace que volver a borrar un root ya limpio sea inofensivo.
after(() => {
  for (const root of created) clean(root)
})
const hookOf = (root) => path.join(root, '.git', 'hooks', 'commit-msg')
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8')

describe('the shipped guard is present and runnable', () => {
  // Only the half of the claim that version control can carry. The OTHER half —
  // that some clone has it wired — cannot be asserted here: the wiring lives
  // under `.git/`, which git never tracks, so a fresh clone cannot satisfy it.
  // A gate that fails on every clone teaches contributors to ignore it.
  it('exists and is executable in this repository', () => {
    const a = auditGitGuard(REPO)

    assert.equal(a.guardPresent, true, `${GUARD_RELATIVE} no existe`)
    assert.equal(a.guardExecutable, true, `${GUARD_RELATIVE} no es ejecutable`)
  })
})

describe('wiring the guard as commit-msg', () => {
  it('writes an executable hook that invokes the guard', () => {
    const root = workspace()

    const r = installGitGuard(root)

    assert.equal(r.changed, true)
    assert.equal(r.skipped, '')
    assert.match(read(root, '.git/hooks/commit-msg'), /pre-commit-aoi-guard\.sh/)
    assert.equal(auditGitGuard(root).reachable, true)
    clean(root)
  })

  it('is idempotent: a second run rewrites nothing', () => {
    const root = workspace()

    installGitGuard(root)
    const first = read(root, '.git/hooks/commit-msg')
    const second = installGitGuard(root)

    assert.equal(second.changed, false)
    assert.equal(read(root, '.git/hooks/commit-msg'), first)
    clean(root)
  })

  it('refreshes a frozen copy instead of reporting it as already wired', () => {
    // The regression this module exists to prevent. `setup.sh` used to `cp` the
    // guard into place; the next run matched that copy with
    // `grep -q "pre-commit-aoi-guard.sh"`, printed "already chained (skipped)",
    // and left a duplicate of a file that IS updated on every reinstall.
    const root = workspace({ files: { '.git/hooks/commit-msg': '#!/bin/bash\n# pre-commit-aoi-guard.sh (copia vieja)\nexit 0\n' } })

    const r = installGitGuard(root)

    assert.equal(r.changed, true, 'una copia congelada tiene que reescribirse como shim')
    const body = read(root, '.git/hooks/commit-msg')
    assert.match(body, /install-git-guard\.mjs/)
    assert.doesNotMatch(body, /copia vieja/)
    clean(root)
  })

  it('skips a tree that is not a git repository', () => {
    const root = workspace({ git: false })

    const r = installGitGuard(root)

    assert.equal(r.changed, false)
    assert.match(r.skipped, /not a git repository/)
    clean(root)
  })
})

describe('a hook the Owner wrote is never discarded', () => {
  it('preserves it as .aoi-bak and still runs it, after the guard', () => {
    const root = workspace({
      files: { '.git/hooks/commit-msg': '#!/bin/bash\necho hook-propio\n' },
    })

    installGitGuard(root)

    assert.equal(read(root, '.git/hooks/commit-msg.aoi-bak'), '#!/bin/bash\necho hook-propio\n')
    const shim = read(root, '.git/hooks/commit-msg')
    assert.match(shim, /commit-msg\.aoi-bak/, 'el shim tiene que delegar al hook original')
    // Guard first, delegation second: the guard is the thing that must not be
    // bypassed, so it cannot sit behind a hook that might exit early.
    assert.ok(
      shim.indexOf('pre-commit-aoi-guard.sh') < shim.indexOf('commit-msg.aoi-bak'),
      'el guard corre primero'
    )
    clean(root)
  })

  it('keeps an earlier .aoi-bak under a timestamp rather than overwriting it', () => {
    const root = workspace({
      files: {
        '.git/hooks/commit-msg': '#!/bin/bash\n# hook nuevo\n',
        '.git/hooks/commit-msg.aoi-bak': '#!/bin/bash\n# hook ORIGINAL\n',
      },
    })

    installGitGuard(root)

    const kept = fs.readdirSync(path.join(root, '.git', 'hooks')).filter((f) => /^commit-msg\.aoi-bak\./.test(f))
    assert.equal(kept.length, 1, 'el .aoi-bak previo se conserva con marca de tiempo')
    assert.equal(read(root, path.join('.git', 'hooks', kept[0])), '#!/bin/bash\n# hook ORIGINAL\n')
    clean(root)
  })
})

describe('retiring the pre-commit wiring a previous AOI left behind', () => {
  // Left in place it blocks FIRST, before commit-msg ever runs, so the
  // `[aoi-managed-ok]` override its own error message tells the operator to use
  // stays unreachable no matter how correct the new hook is.
  it('removes it when there is no displaced hook to restore', () => {
    const root = workspace({ files: { '.git/hooks/pre-commit': '#!/bin/bash\n# pre-commit-aoi-guard.sh\n' } })

    const r = installGitGuard(root)

    assert.equal(fs.existsSync(path.join(root, '.git', 'hooks', 'pre-commit')), false)
    assert.ok(r.actions.some((a) => /retired the guard from pre-commit/.test(a)))
    clean(root)
  })

  it('restores the project hook the guard had displaced', () => {
    const root = workspace({
      files: {
        '.git/hooks/pre-commit': '#!/bin/bash\n# pre-commit-aoi-guard.sh\n',
        '.git/hooks/pre-commit.aoi-bak': '#!/bin/bash\n# pre-commit-propio\n',
      },
    })

    installGitGuard(root)

    assert.equal(read(root, '.git/hooks/pre-commit'), '#!/bin/bash\n# pre-commit-propio\n')
    clean(root)
  })

  it('leaves a pre-commit that is not ours exactly as it was', () => {
    const root = workspace({ files: { '.git/hooks/pre-commit': '#!/bin/bash\n# lint-propio\n' } })

    installGitGuard(root)

    assert.equal(read(root, '.git/hooks/pre-commit'), '#!/bin/bash\n# lint-propio\n')
    clean(root)
  })
})

describe('the audit refuses to call an unreachable guard wired', () => {
  it('rejects a missing guard script', () => {
    const root = workspace({ guard: false })
    installGitGuard(root)

    const a = auditGitGuard(root)

    assert.equal(a.hookPresent, true, 'el hook está')
    assert.equal(a.guardPresent, false)
    assert.equal(a.reachable, false, 'un hook que llama a un script ausente está inerte')
    clean(root)
  })

  it('rejects a guard that is present but not executable', () => {
    const root = workspace()
    installGitGuard(root)
    fs.chmodSync(path.join(root, GUARD_RELATIVE), 0o644)

    assert.equal(auditGitGuard(root).reachable, false)
    clean(root)
  })

  it('rejects a hook present but not executable', () => {
    const root = workspace()
    installGitGuard(root)
    fs.chmodSync(hookOf(root), 0o644)

    assert.equal(auditGitGuard(root).reachable, false)
    clean(root)
  })

  it('rejects a correctly installed hook when core.hooksPath points elsewhere', () => {
    // git stops reading `.git/hooks/` entirely once `core.hooksPath` is set, so
    // the file can be perfect, executable, and dead. Same failure shape as the
    // original bug, one layer down — which is why the audit does not stop at
    // "the file exists".
    const root = workspace()
    installGitGuard(root)
    const execFn = (cmd, args) => (args.includes('core.hooksPath') ? '/somewhere/else' : '')

    const a = auditGitGuard(root, execFn)

    assert.equal(a.hookPresent, true)
    assert.equal(a.hooksPath, '/somewhere/else')
    assert.equal(a.reachable, false)
    clean(root)
  })
})

describe('telling an installed workspace from the development repository', () => {
  it('reads the install manifest as the marker', () => {
    const installed = workspace({ files: { '.conf/manifest.json': '{}' } })
    const dev = workspace()

    assert.equal(isInstalledWorkspace(installed), true)
    assert.equal(isInstalledWorkspace(dev), false)
    clean(installed)
    clean(dev)
  })

  it('does not read this tree as an installed workspace', (t) => {
    // The distinction is load-bearing: the wiring lives under `.git/`, which is
    // never versioned, so it can only be enforced where an installer has run.
    // It is also a claim ABOUT this tree, so it only holds in the development
    // repository. In an install this same tree IS the install, the marker is
    // there and correct, and asserting otherwise fails a non-defect.
    //
    // The discriminator is `setup.sh` — deliberately NOT `isInstalledWorkspace`,
    // whose failure mode this test exists to catch. Guarding a test with the
    // function under test lets a broken marker skip its own detector.
    if (!fs.existsSync(path.join(REPO, 'setup.sh'))) {
      // `t.skip()` marca el caso como salteado pero NO detiene la ejecución: sin
      // este `return` la aserción de abajo corre igual y el caso se reporta
      // salteado Y fallado a la vez, haciendo salir `pnpm test` con 1 dentro de
      // un workspace instalado mientras cada suite imprime `fail 0`.
      t.skip('workspace instalado: el veredicto no es sobre AOI')
      return
    }

    assert.equal(isInstalledWorkspace(REPO), false, 'el repo AOI no es un workspace instalado')
  })
})

describe('reading core.hooksPath', () => {
  it('returns an empty string when git cannot answer', () => {
    // El workspace se creaba DENTRO de la aserción: sin variable no había
    // `clean()` posible, y cada corrida dejaba un directorio vivo.
    const root = workspace({ git: false })
    assert.equal(readHooksPath(root, () => { throw new Error('no git') }), '')
  })
})
