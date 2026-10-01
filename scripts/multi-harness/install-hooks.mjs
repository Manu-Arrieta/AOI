#!/usr/bin/env node
/**
 * scripts/multi-harness/install-hooks.mjs
 *
 * Wires the hook declarations in `.github/hooks/` into the place the harness
 * actually reads them from.
 *
 * The audit found five hook files — RTK rewriting, ICM capture, session init
 * and close, post-tool learning — that no harness loaded. The `.sh` scripts
 * they invoke all existed, the scaffold mirrored them, and setup.sh even made
 * them executable. Nothing ever registered them.
 *
 * That is worse than dead configuration, because a surface loaded in all six
 * phases advertises the result as automatic:
 *
 *     .github/skills/rtk/SKILL.md
 *     "The `PreToolUse` hook (`rtk-rewrite.json`) automatically enforces RTK
 *      prefixing."
 *
 * An agent reads that — at 2.526 tokens a cycle — and reasonably relaxes about
 * a rule AOI calls MANDATORY, while nothing enforces it.
 *
 * The declarations use Copilot's shape: `hooks.<Event>[] = {type, command}`.
 * Claude Code nests one level deeper and matches on tool name — and that was
 * NOT the whole job: copying the commands verbatim left relative paths, the
 * Copilot dialect of RTK, the session close on every turn and every ICM
 * injection twice. What reaches Claude Code is decided in
 * `claude-hook-plan.mjs`; what the audit refuses, in `hook-wiring-audit.mjs`.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CLAUDE_SETTINGS, findIcm, planClaude, readDeclarations, readUserHooks, userSettingsPath } from './claude-hook-plan.mjs'
import { auditHookWiring } from './hook-wiring-audit.mjs'
import { auditGitGuard, installGitGuard, isInstalledWorkspace, parseCliArgs } from './install-git-guard.mjs'
import { measureInjection } from './hook-simulation.mjs'

// `check-hook-wiring.mjs` y los tests los importan desde acá desde antes del corte.
export { auditHookWiring, readDeclarations }

/**
 * Translates the declarations into Claude Code's settings shape. The output
 * depends on the tree alone: written from this machine's user scope, the
 * tracked file carried no ICM hook and a clone without `icm init --mode hook`
 * ran Claude Code with no ICM at all — which is now every new install, since
 * setup.sh stopped running that init so the project's wrapper (and its
 * per-session recall filter) is the only injector. Where an older install left
 * user-scope icm hooks, `icm-hook.sh` steps aside when the hook fires.
 *
 * @returns {{ hooks: object }}
 */
export function toClaudeSettings(declarations) {
  const hooks = {}
  for (const p of planClaude(declarations)) {
    hooks[p.event] ??= []
    const group = hooks[p.event].find((g) => g.matcher === p.matcher)
    const hook = { type: 'command', command: p.command }
    if (p.timeout) hook.timeout = p.timeout
    if (group) group.hooks.push(hook)
    else hooks[p.event].push(p.matcher ? { matcher: p.matcher, hooks: [hook] } : { hooks: [hook] })
  }
  return { hooks }
}

/**
 * Writes the translated hooks into `.claude/settings.json`, preserving whatever
 * else the Owner has configured there.
 *
 * Only the `hooks` key is replaced. Everything else — permissions, env, model
 * — belongs to the Owner and is left untouched, because an installer that
 * rewrites a settings file wholesale is the same mistake as an installer that
 * deletes a customised CLAUDE.md. The user settings are never read nor written.
 */
export function installClaudeHooks(root, declarations) {
  const target = path.join(root, CLAUDE_SETTINGS)
  let existing = {}
  if (fs.existsSync(target)) {
    try {
      existing = JSON.parse(fs.readFileSync(target, 'utf8'))
    } catch {
      existing = {}
    }
  }

  const merged = { ...existing, ...toClaudeSettings(declarations) }
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, `${JSON.stringify(merged, null, 2)}\n`)
  return CLAUDE_SETTINGS
}

/**
 * Wires the git guard, or reports why it is unreachable.
 *
 * Kept next to the harness hooks because it is the same failure shape one layer
 * down. The guard script is governed and travels inside the scaffold, so every
 * profile receives it — but the wiring lived in `setup.sh`'s
 * `PROFILE_INCLUDES_ADVANCED` branch, so a `core` install received the script
 * and never the hook. The result was a guard that is installed, executable,
 * documented as blocking commits, and unable to ever run.
 *
 * @returns {boolean} whether an installed workspace was left unguarded
 */
function reportGitGuard(root, { audit }) {
  const r = auditGitGuard(root)

  if (!r.gitRepo) {
    console.log('  — Guard de git: no es un repo git todavía (se activa con git init).')
    return false
  }

  if (!audit) {
    const res = installGitGuard(root)
    console.log(`✅ Guard de git → .git/hooks/commit-msg${res.changed ? '' : ' (ya estaba cableado)'}`)
    for (const a of res.actions) console.log(`   · ${a}`)
    return false
  }

  if (r.reachable) {
    console.log('  ✅ Guard de git: cableado como commit-msg y alcanzable')
    return false
  }

  const why = !r.guardPresent
    ? '.githooks/pre-commit-aoi-guard.sh no existe'
    : !r.guardExecutable
      ? '.githooks/pre-commit-aoi-guard.sh no es ejecutable'
      : !r.hookPresent
        ? '.git/hooks/commit-msg no existe — el guard no puede bloquear nada'
        : !r.hookReferencesGuard
          ? '.git/hooks/commit-msg no invoca el guard'
          : r.hooksPath
            ? `core.hooksPath='${r.hooksPath}' — git deja de leer .git/hooks/`
            : 'causa desconocida'

  // Hard only where an installer ran and therefore promised the wiring. The
  // hook lives under `.git/`, which git never versions: a fresh clone and CI
  // have no `commit-msg` and never will, so gating unconditionally would fail
  // for a non-defect and teach contributors to bypass the gate.
  const enforce = isInstalledWorkspace(root)
  const line = `  ❌ Guard de git: ${why}`
  if (enforce) console.error(line)
  else console.log(`${line}   (no es un workspace instalado — informativo)`)
  return enforce
}

/** Imprime la auditoría de hooks; devuelve si hay algo que la hace fallar. */
function reportHookAudit(root, r, declarations) {
  console.log('=== AOI Hook Wiring ===\n')
  if (declarations.length === 0) {
    console.log('  — no hay declaraciones en .github/hooks/')
    return false
  }
  console.log('  .github/hooks/ es la convención de Copilot: una declaración acá ya la carga.')
  console.log('  Lo que se audita es Claude Code y que los scripts existan y sean ejecutables.\n')
  for (const s of r.wired) console.log(`  ✅ ${s}`)
  for (const s of r.skippedAtRuntime) console.log(`     ↳ ${s} — acá lo dispara el settings de usuario; icm-hook.sh se omite al disparar`)
  for (const s of r.orphaned) console.error(`  ❌ ${s} — no llega entera a Claude Code`)
  for (const s of r.missing) console.error(`     ↳ ${s} — no la cablea ningún scope`)
  for (const s of r.userScopeOnly) console.error(`     ↳ ${s} — sólo el scope de usuario de ESTA máquina; una instalación nueva (setup ya no corre icm init --mode hook) queda sin ella`)
  for (const s of r.broken) console.error(`  ❌ ${s}`)
  for (const s of r.violations) console.error(`  ❌ ${s}`)

  // Aviso y no falla: el scope de usuario no es de AOI. Pero los bytes van
  // medidos, porque "duplicado" sin magnitud no mueve a nadie a arreglarlo.
  const icm = r.duplicates.length > 0 ? findIcm() : null
  for (const d of r.duplicates) {
    const bytes = icm ? measureInjection(icm, d.mode, d.event, root) : null
    const size = bytes === null ? 'sin medir' : `+${bytes} B por disparo`
    console.log(`  ⚠️  ${d.event}: icm hook ${d.mode} se inyecta desde usuario Y proyecto (${size})`)
  }
  return r.orphaned.length > 0 || r.broken.length > 0 || r.violations.length > 0
}

function main() {
  const root = process.cwd()
  const { values, error } = parseCliArgs(process.argv.slice(2), { flags: ['--audit'], options: ['--user-settings'] })
  if (error) {
    console.error(`${error}\nUso: install-hooks.mjs [--audit] [--user-settings <settings.json>]`)
    process.exit(2)
  }
  const declarations = readDeclarations(root)

  if (values.audit) {
    const userHooks = readUserHooks(values['user-settings'] ?? userSettingsPath())
    const r = auditHookWiring(root, { userHooks })
    const hooksFail = reportHookAudit(root, r, declarations)
    const gitGuardUnreachable = reportGitGuard(root, { audit: true })

    if (hooksFail) {
      console.error('\nUn hook que nadie carga, o que falla al disparar, es una regla que el agente cree activa y no lo está.')
      console.error('Arreglo: node scripts/multi-harness/install-hooks.mjs')
      process.exit(1)
    }
    if (gitGuardUnreachable) {
      console.error('\nEl guard de git está instalado pero no cablea, así que no bloquea nada.')
      console.error('Arreglo: node scripts/multi-harness/install-git-guard.mjs')
      process.exit(1)
    }
    console.log('\n✅ Cada declaración llega a la configuración de un harness.')
    return
  }

  if (declarations.length > 0) {
    const written = installClaudeHooks(root, declarations)
    console.log(`✅ ${declarations.length} declaración(es) → ${written}`)
  } else {
    console.log('No hay declaraciones en .github/hooks/ — nada que cablear.')
  }
  reportGitGuard(root, { audit: false })
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
