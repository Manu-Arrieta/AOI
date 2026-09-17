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
 * Claude Code nests one level deeper and matches on tool name, so translating
 * is the whole job here.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditGitGuard, installGitGuard, isInstalledWorkspace } from './install-git-guard.mjs'

const HOOKS_DIR = '.github/hooks'
const CLAUDE_SETTINGS = '.claude/settings.json'

/** Which tools each event should match in Claude Code. */
const MATCHER = {
  PreToolUse: 'Bash',
  PostToolUse: 'Bash',
}

/** Reads every declaration under `.github/hooks/`. */
export function readDeclarations(root, dir = HOOKS_DIR) {
  const full = path.join(root, dir)
  if (!fs.existsSync(full)) return []

  const out = []
  for (const name of fs.readdirSync(full).sort()) {
    if (!name.endsWith('.json')) continue
    try {
      out.push({ source: `${dir}/${name}`, hooks: JSON.parse(fs.readFileSync(path.join(full, name), 'utf8')).hooks ?? {} })
    } catch {
      // A declaration that will not parse is reported by the audit rather than
      // crashing the installer mid-run.
      out.push({ source: `${dir}/${name}`, hooks: null })
    }
  }
  return out
}

/**
 * Translates the declarations into Claude Code's settings shape.
 *
 * @returns {{ hooks: object }}
 */
export function toClaudeSettings(declarations) {
  const hooks = {}
  for (const { hooks: decl } of declarations) {
    if (!decl) continue
    for (const [event, entries] of Object.entries(decl)) {
      for (const entry of entries) {
        if (!entry?.command) continue
        hooks[event] ??= []
        const matcher = MATCHER[event]
        const group = hooks[event].find((g) => g.matcher === matcher)
        const hook = { type: 'command', command: entry.command }
        if (entry.timeout) hook.timeout = entry.timeout
        if (group) group.hooks.push(hook)
        else hooks[event].push(matcher ? { matcher, hooks: [hook] } : { hooks: [hook] })
      }
    }
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
 * deletes a customised CLAUDE.md.
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
 * Reports declarations that reach no harness config, and scripts that cannot run.
 *
 * `.github/hooks/` is not AOI's invention: it is GitHub Copilot's own
 * convention, verified by running `rtk init --copilot` in a clean directory —
 * RTK writes its hook to exactly this path, with exactly this JSON shape. So
 * a declaration sitting here is ALREADY loaded by Copilot, and the audit's job
 * is the other harnesses plus the scripts themselves.
 *
 * Claude Code nests one level deeper and reads `.claude/settings.json`, which
 * is why the translation above exists.
 *
 * The third failure mode has nothing to do with wiring: a hook whose script is
 * missing or not executable is registered, fires, and fails on every single
 * tool call.
 *
 * @returns {{ declared: string[], wired: string[], orphaned: string[], broken: string[] }}
 */
export function auditHookWiring(root) {
  const declarations = readDeclarations(root)
  const declared = declarations.map((d) => d.source)

  const settingsPath = path.join(root, CLAUDE_SETTINGS)
  const settings = fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, 'utf8') : ''

  const wired = []
  const orphaned = []
  const broken = []
  for (const d of declarations) {
    const commands = Object.values(d.hooks ?? {})
      .flat()
      .map((e) => e?.command)
      .filter(Boolean)

    // Every `bash <path>` a declaration invokes must exist and be executable.
    for (const cmd of commands) {
      const m = /^bash\s+(\S+)/.exec(cmd)
      if (!m) continue
      const script = path.join(root, m[1])
      if (!fs.existsSync(script)) broken.push(`${d.source} → ${m[1]} no existe`)
      else {
        try {
          fs.accessSync(script, fs.constants.X_OK)
        } catch {
          broken.push(`${d.source} → ${m[1]} no es ejecutable`)
        }
      }
    }

    // A declaration counts as wired when every command it declares appears in
    // a harness config. Partial wiring is orphaned: half a hook chain is a
    // rule that fires sometimes, which is worse than one that never fires.
    if (commands.length > 0 && commands.every((c) => settings.includes(c))) wired.push(d.source)
    else orphaned.push(d.source)
  }
  return { declared, wired, orphaned, broken }
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

function main() {
  const root = process.cwd()
  const audit = process.argv.includes('--audit')
  const declarations = readDeclarations(root)

  if (audit) {
    const r = auditHookWiring(root)
    console.log('=== AOI Hook Wiring ===\n')
    if (declarations.length > 0) {
      console.log('  .github/hooks/ es la convención de Copilot: una declaración acá ya la carga.')
      console.log('  Lo que se audita es Claude Code y que los scripts existan y sean ejecutables.\n')
      for (const s of r.wired) console.log(`  ✅ ${s}`)
      for (const s of r.orphaned) console.error(`  ❌ ${s} — no llega a Claude Code`)
      for (const s of r.broken) console.error(`  ❌ ${s}`)
    } else {
      console.log('  — no hay declaraciones en .github/hooks/')
    }

    const gitGuardUnreachable = reportGitGuard(root, { audit: true })

    if (r.orphaned.length > 0 || r.broken.length > 0) {
      console.error('\nUn hook que nadie carga es una regla que el agente cree activa y no lo está.')
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
