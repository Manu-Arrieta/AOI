// scripts/multi-harness/check-hook-wiring.mjs
//
// The doctor's hook-wiring check: are the hooks AOI ships actually REACHABLE,
// not merely present?
//
// Its own module rather than a seventh function in `doctor-checks.mjs`, which
// sat at 253 LOC and would have crossed the 300 limit. Invariant 5's sanctioned
// remedy is to split, not to exempt, and this is a different question from the
// others there: they ask what the workspace HAS, this one asks whether what it
// has can fire.
//
// Two artifacts, one question, and they do not deserve the same severity:
//
//   - The harness hooks are wired into `.claude/settings.json`, which IS
//     versioned. Their absence is a defect anywhere.
//   - The managed-files git guard is wired into `.git/hooks/commit-msg`, which
//     git NEVER versions. Only a tree an installer has run in can be held to it,
//     and the install manifest is the marker that one ran.
//
// The severity is dynamic for that reason, not out of leniency. The guard script
// is parity-governed and reaches every profile through the scaffold merge, while
// its wiring used to live in `setup.sh`'s advanced-only branch — which is what
// left every `core` install with a guard that was installed, executable,
// documented as blocking commits, and unable to run. This is the check whose
// absence let two `/init` runs report a green guard over an inert one.

import { auditGitGuard, isInstalledWorkspace } from './install-git-guard.mjs'
import { auditHookWiring } from './install-hooks.mjs'

/**
 * @returns {{ status: 'PASSED'|'WARNING'|'FAILED', details: string }}
 */
export function checkHookWiring(repoRoot) {
  const harness = auditHookWiring(repoRoot)
  const harnessOk = harness.orphaned.length === 0 && harness.broken.length === 0

  if (!harnessOk) {
    const bad = [...harness.orphaned.map((s) => `${s} sin cablear`), ...harness.broken]
    return { status: 'FAILED', details: `Hooks de harness: ${bad.join('; ')}` }
  }

  const wired = `${harness.wired.length} declaración(es) de harness cableada(s)`
  const guard = auditGitGuard(repoRoot)

  if (!guard.gitRepo) {
    return { status: 'PASSED', details: `${wired} · sin repo git todavía` }
  }
  if (guard.reachable) {
    return { status: 'PASSED', details: `${wired} · guard de git cableado como commit-msg` }
  }

  const why = !guard.guardPresent
    ? '.githooks/pre-commit-aoi-guard.sh ausente'
    : !guard.guardExecutable
      ? '.githooks/pre-commit-aoi-guard.sh no ejecutable'
      : !guard.hookPresent
        ? '.git/hooks/commit-msg ausente'
        : !guard.hookReferencesGuard
          ? '.git/hooks/commit-msg no invoca el guard'
          : guard.hooksPath
            ? `core.hooksPath='${guard.hooksPath}' desvía git de .git/hooks/`
            : 'causa desconocida'

  if (isInstalledWorkspace(repoRoot)) {
    // Un instalador prometió este cableado: que falte es una falla, no un aviso.
    return {
      status: 'FAILED',
      details: `Guard de git inerte: ${why}. Arreglo: node scripts/multi-harness/install-git-guard.mjs`,
    }
  }

  // Repo de desarrollo o clon fresco. `.git/hooks/` no se versiona, así que
  // exigirlo acá haría fallar todo clon nuevo por algo que no es un defecto — y
  // una compuerta que falla por un no-defecto es una que se aprende a saltear.
  return { status: 'WARNING', details: `Sin repo instalado: guard de git informativo (${why})` }
}
