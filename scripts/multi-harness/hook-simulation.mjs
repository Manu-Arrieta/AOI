#!/usr/bin/env node
/**
 * scripts/multi-harness/hook-simulation.mjs
 *
 * Ejecuta, por evento, cada comando de hook que Claude Code dispararía —scope
 * de usuario más scope de proyecto— con un stdin de muestra, y cuenta los
 * bytes que deja en stdout.
 *
 * Existe porque la auditoría de hooks comparaba CADENAS: "¿el comando
 * declarado aparece en el settings?". Esa comparación dio verde mientras, en
 * 111 transcripts reales, el mismo `icm hook prompt` se inyectaba dos veces por
 * prompt (270 164 B, ~67k tokens), `session-close-hook.sh` imprimía ~35 KB de
 * `icm health` delante de su JSON, y cuatro hooks fallaban 42-43 veces cada uno
 * porque su ruta relativa dejaba de resolver al cambiar el cwd. Ninguno de los
 * tres se ve sin correr la configuración.
 *
 * Para que la simulación no toque la base real de ICM, `--icm <bin>` reemplaza
 * cada `icm` que corra un handler —el absoluto del scope de usuario y el que
 * los scripts encuentran por PATH— por ese binario: un shim que apunta a una
 * COPIA de la base, o uno que sólo registra.
 *
 *   node scripts/multi-harness/hook-simulation.mjs --project <raíz> [--user <settings.json>] [--cwd <dir>] [--icm <bin>] [--json]
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { userSettingsPath } from './claude-hook-plan.mjs'
import { parseCliArgs } from './install-git-guard.mjs'

/** Eventos cuyo stdout en texto plano Claude Code agrega al contexto del modelo. */
export const CONTEXT_EVENTS = new Set(['SessionStart', 'UserPromptSubmit'])

function matcherApplies(matcher, toolName) {
  if (!matcher || matcher === '*' || !toolName) return true
  try {
    return new RegExp(`^(?:${matcher})$`).test(toolName)
  } catch {
    return matcher === toolName
  }
}

/**
 * Los handlers que corren para un evento, en orden de scope. Una cadena de
 * comando idéntica en dos scopes corre una sola vez: es la única deduplicación
 * que hace Claude Code.
 */
export function handlersFor(scopes, event, toolName) {
  const seen = new Set()
  const out = []
  for (const { name, settings } of scopes) {
    for (const group of settings?.hooks?.[event] ?? []) {
      if (!matcherApplies(group?.matcher, toolName)) continue
      for (const h of group?.hooks ?? []) {
        if (!h?.command || (h.type && h.type !== 'command') || seen.has(h.command)) continue
        seen.add(h.command)
        out.push({ scope: name, command: h.command })
      }
    }
  }
  return out
}

/**
 * Cómo parsea Claude Code un stdout: si empieza con `{` y termina con `}` es
 * JSON; si no, es texto plano entero. Un texto seguido de una línea JSON —lo
 * que imprimían session-init y session-close— es texto: el JSON llega al
 * modelo como basura y sus campos nunca se aplican.
 */
export function classifyStdout(stdout) {
  const t = String(stdout ?? '').trim()
  if (!t) return 'empty'
  if (t.startsWith('{') && t.endsWith('}')) {
    try {
      JSON.parse(t)
      return 'json'
    } catch {
      // un objeto roto se lee como texto
    }
  }
  const lines = t.split('\n')
  if (lines.length > 1) {
    try {
      JSON.parse(lines.at(-1).trim())
      return 'text+json'
    } catch {
      // texto puro
    }
  }
  return 'text'
}

/** ¿Es salida legítima para ese evento? Sólo los eventos de contexto aceptan texto. */
export function validFor(event, kind) {
  if (kind === 'empty' || kind === 'json') return true
  return kind === 'text' && CONTEXT_EVENTS.has(event)
}

/** Un disparo de muestra por evento, con la forma de stdin que manda Claude Code. */
export function sampleEvents(cwd) {
  const base = { session_id: 'aoi-hook-simulation', transcript_path: '/dev/null', cwd }
  const bash = { tool_name: 'Bash', tool_input: { command: 'git status' } }
  const ev = (hook_event_name, extra = {}, toolName) => ({
    event: hook_event_name,
    toolName,
    stdin: JSON.stringify({ ...base, hook_event_name, ...extra }),
  })
  return [
    ev('SessionStart', { source: 'startup' }),
    ev('UserPromptSubmit', { prompt: 'arreglá el cableado de hooks de Claude Code en install-hooks' }),
    ev('PreToolUse', bash, 'Bash'),
    ev('PostToolUse', { ...bash, tool_response: { stdout: 'On branch main', stderr: '' } }, 'Bash'),
    ev('PreCompact', { trigger: 'auto', custom_instructions: '' }),
    ev('Stop', { stop_hook_active: false }),
    ev('SessionEnd', { reason: 'other' }),
  ]
}

/**
 * Corre cada handler de cada evento y mide su stdout.
 *
 * @returns {Array<{ event, handlers, stdoutBytes, failures, invalid, runs }>}
 */
/** El comando con su `icm` inicial cambiado por `icmBin`; el resto, intacto. */
export function withIcm(command, icmBin) {
  if (!icmBin) return command
  const [first, ...rest] = command.trim().split(/\s+/)
  return path.basename(first.replace(/["']/g, '')) === 'icm' ? [JSON.stringify(icmBin), ...rest].join(' ') : command
}

export function simulate({ scopes, events, cwd, env = process.env, projectDir, icmBin, timeoutMs = 30000 }) {
  const runEnv = { ...env, ...(projectDir ? { CLAUDE_PROJECT_DIR: projectDir } : {}) }
  if (icmBin) runEnv.PATH = `${path.dirname(icmBin)}${path.delimiter}${runEnv.PATH ?? ''}`
  // Sin shim, el `icm` real corre en sólo-lectura: `hook post`, `end` y
  // `health` escriben en la base, y una medición no tiene por qué ensuciarla.
  else runEnv.ICM_READONLY = '1'
  // `icm-hook.sh <modo> claude` decide si se omite leyendo el settings de
  // usuario. Sin esto lo leía de la máquina real: la simulación medía un scope
  // y el script decidía con otro.
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-sim-config-'))
  const user = scopes.find((s) => s.name === 'user')?.settings ?? {}
  fs.writeFileSync(path.join(configDir, 'settings.json'), JSON.stringify(user))
  runEnv.CLAUDE_CONFIG_DIR = configDir
  try {
    return runEvents({ scopes, events, cwd, runEnv, icmBin, timeoutMs })
  } finally {
    fs.rmSync(configDir, { recursive: true, force: true })
  }
}

function runEvents({ scopes, events, cwd, runEnv, icmBin, timeoutMs }) {
  return events.map(({ event, toolName, stdin }) => {
    const runs = handlersFor(scopes, event, toolName).map((h) => {
      const r = spawnSync('bash', ['-c', withIcm(h.command, icmBin)], { cwd, env: runEnv, input: stdin, encoding: 'utf8', timeout: timeoutMs })
      const stdout = r.stdout ?? ''
      const kind = classifyStdout(stdout)
      return {
        ...h,
        exit: r.status,
        stdoutBytes: Buffer.byteLength(stdout),
        kind,
        valid: r.status === 0 && validFor(event, kind),
        stderr: String(r.stderr ?? '').slice(0, 160),
      }
    })
    return {
      event,
      handlers: runs.length,
      stdoutBytes: runs.reduce((n, r) => n + r.stdoutBytes, 0),
      failures: runs.filter((r) => r.exit !== 0).length,
      invalid: runs.filter((r) => !r.valid).length,
      runs,
    }
  })
}

/** Bytes que un `icm hook <modo>` deja en stdout, corrido en modo sólo-lectura. */
export function measureInjection(icmBin, mode, event, cwd) {
  const sample = sampleEvents(cwd).find((e) => e.event === event)
  const r = spawnSync(icmBin, ['--read-only', 'hook', mode], {
    input: sample?.stdin ?? '{}',
    env: { ...process.env, ICM_READONLY: '1' },
    encoding: 'utf8',
    timeout: 20000,
  })
  return r.status === 0 ? Buffer.byteLength(r.stdout ?? '') : null
}

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

function parseArgs(argv) {
  const { values, error } = parseCliArgs(argv, { flags: ['--json'], options: ['--project', '--user', '--cwd', '--icm'] })
  if (error) {
    console.error(`${error}\nUso: hook-simulation.mjs --project <raíz> [--user <settings.json>] [--cwd <dir>] [--icm <bin>] [--json]`)
    process.exit(2)
  }
  return { project: process.cwd(), user: userSettingsPath(), cwd: null, json: false, icm: null, ...values }
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  const project = path.resolve(opts.project)
  const cwd = path.resolve(opts.cwd ?? project)
  const scopes = [
    { name: 'user', settings: readJson(opts.user) },
    { name: 'project', settings: readJson(path.join(project, '.claude/settings.json')) },
  ]
  const result = simulate({ scopes, events: sampleEvents(cwd), cwd, projectDir: project, icmBin: opts.icm ? path.resolve(opts.icm) : null })
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  for (const e of result) {
    console.log(`${e.event.padEnd(17)} handlers=${e.handlers} stdout=${e.stdoutBytes}B fallidos=${e.failures} inválidos=${e.invalid}`)
    for (const r of e.runs) console.log(`  [${r.scope}] exit=${r.exit} ${r.stdoutBytes}B ${r.kind}  ${r.command}`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
