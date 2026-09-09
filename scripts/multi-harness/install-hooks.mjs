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
 * Reports declarations that reach no harness config.
 *
 * @returns {{ declared: string[], wired: string[], orphaned: string[] }}
 */
export function auditHookWiring(root) {
  const declarations = readDeclarations(root)
  const declared = declarations.map((d) => d.source)

  const settingsPath = path.join(root, CLAUDE_SETTINGS)
  const settings = fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, 'utf8') : ''

  const wired = []
  const orphaned = []
  for (const d of declarations) {
    const commands = Object.values(d.hooks ?? {})
      .flat()
      .map((e) => e?.command)
      .filter(Boolean)
    // A declaration counts as wired when every command it declares appears in
    // a harness config. Partial wiring is orphaned: half a hook chain is a
    // rule that fires sometimes, which is worse than one that never fires.
    if (commands.length > 0 && commands.every((c) => settings.includes(c))) wired.push(d.source)
    else orphaned.push(d.source)
  }
  return { declared, wired, orphaned }
}

function main() {
  const root = process.cwd()
  const declarations = readDeclarations(root)
  if (declarations.length === 0) {
    console.log('No hay declaraciones en .github/hooks/ — nada que cablear.')
    return
  }

  if (process.argv.includes('--audit')) {
    const r = auditHookWiring(root)
    console.log('=== AOI Hook Wiring ===\n')
    for (const s of r.wired) console.log(`  ✅ ${s}`)
    for (const s of r.orphaned) console.error(`  ❌ ${s} — declarado y no cargado por ningún harness`)
    if (r.orphaned.length > 0) {
      console.error('\nUn hook que nadie carga es una regla que el agente cree activa y no lo está.')
      process.exit(1)
    }
    console.log('\n✅ Cada declaración llega a la configuración de un harness.')
    return
  }

  const written = installClaudeHooks(root, declarations)
  console.log(`✅ ${declarations.length} declaración(es) → ${written}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
