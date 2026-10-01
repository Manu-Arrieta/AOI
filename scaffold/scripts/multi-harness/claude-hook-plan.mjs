/**
 * scripts/multi-harness/claude-hook-plan.mjs
 *
 * Decide qué llega a Claude Code de cada declaración de `.github/hooks/`, y con
 * qué forma. Las declaraciones están en el dialecto de Copilot; copiarlas tal
 * cual a `.claude/settings.json` —lo que hacía `install-hooks.mjs`— dejaba
 * cuatro defectos medidos sobre los 111 transcripts reales de este repositorio:
 *
 *   1. Rutas relativas. `bash .github/scripts/icm-hook.sh` sólo resuelve si el
 *      cwd del shell es la raíz, y Claude Code corre los hooks en el cwd ACTUAL
 *      ("Handlers run in the current directory", docs de hooks). En cuanto una
 *      sesión hacía `cd` fuera, 42-43 disparos × 4 hooks fallaron con "No such
 *      file or directory" y RTK dejó de reescribir sin avisar. Claude Code
 *      exporta `CLAUDE_PROJECT_DIR` a cada hook ("the project root where the
 *      session started"). El `:-.` sólo cubre a quien lea este archivo sin
 *      definirla: cae en la ruta relativa de antes, no en `/.github/...`.
 *   2. Dialecto. `rtk hook copilot` responde `permissionDecision: "ask"`:
 *      fuera del modo bypass, cada comando reescrito pedía permiso. `rtk hook
 *      claude` devuelve el mismo `updatedInput` sin decidir el permiso.
 *   3. Evento. `Stop` en Claude Code corre al final de CADA turno; el cierre de
 *      sesión es `SessionEnd`.
 *   4. Doble scope. `setup.sh` corría `icm init --mode hook`, que registra
 *      `icm hook <modo>` en el settings de USUARIO para start, pre, post,
 *      prompt, compact y end (verificado corriéndolo con un HOME desechable).
 *      El proyecto volvía a llamar al mismo `icm hook <modo>` vía
 *      `icm-hook.sh`, con otra cadena de comando, así que la deduplicación de
 *      Claude Code ("If you define the same handler in more than one settings
 *      file, it runs once") no aplicaba: UserPromptSubmit inyectó 270 164 B
 *      duplicados en 155 prompts (~67k tokens) y SessionStart 97 151 B en 25
 *      arranques (~24k), entre `icm-hook.sh start` y session-init-hook.sh.
 *      Dejar esos modos fuera del proyecto según la máquina que corría el
 *      instalador hizo del archivo versionado algo distinto en cada máquina y
 *      dejó sin ICM a todo clon sin `icm init`. La traducción es la misma en
 *      todas partes y `icm-hook.sh <modo> claude` se omite AL DISPARAR si el
 *      scope de usuario ya corre ese modo.
 *   5. Inyector único. Donde ICM inyectaba desde el scope de usuario, el
 *      filtro de recall por sesión de `icm-hook.sh` (82,2 % de líneas
 *      repetidas) no corría: setup ya no ejecuta `icm init --mode hook`, y el
 *      proyecto lleva los seis modos que ese init registraba para Claude Code.
 *      `end` no tiene declaración en `.github/hooks/` —Copilot no lo recibía
 *      de ICM—, así que lo agrega sólo esta traducción.
 *
 * El scope de usuario sólo lo lee la auditoría, para avisar; jamás se escribe.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const HOOKS_DIR = '.github/hooks'
export const CLAUDE_SETTINGS = '.claude/settings.json'

/** Qué herramientas matchea cada evento en Claude Code. */
export const MATCHER = {
  PreToolUse: 'Bash',
  PostToolUse: 'Bash',
}

const PROJECT_DIR = '${CLAUDE_PROJECT_DIR:-.}'

/** Scripts que hablan más de un dialecto: el argumento que los pone en el de Claude. */
const CLAUDE_DIALECT = { '.github/scripts/rtk-hook.sh': 'claude', '.github/scripts/icm-hook.sh': 'claude' }

/** Scripts cuyo evento de Copilot no significa lo mismo en Claude Code. */
const CLAUDE_EVENT = { '.github/scripts/session-close-hook.sh': 'SessionEnd' }

const ICM_HOOK = '.github/scripts/icm-hook.sh'

/**
 * Lo que `icm init --mode hook` registraba para Claude Code y no para Copilot
 * (~/.copilot/settings.json: start, pre, post y prompt). Sin esta entrada, una
 * instalación nueva —que ya no corre ese init— perdía `icm hook end`, la
 * extracción de la cola que `post` llena, al cerrar cada sesión.
 */
const CLAUDE_ONLY = { [ICM_HOOK]: [{ event: 'SessionEnd', args: ' end' }] }

// `icm init` registró compact y end sin timeout (el default de Claude Code);
// los 10 s de icm.json, pensados para el vaciado del registro, cortarían una
// extracción de transcript cuya duración no se pudo medir sin escribir la base.
const UNTIMED_MODES = new Set(['compact', 'end'])

/** Lee cada declaración de `.github/hooks/`; una que no parsea queda con `hooks: null`. */
export function readDeclarations(root, dir = HOOKS_DIR) {
  const full = path.join(root, dir)
  if (!fs.existsSync(full)) return []
  const out = []
  for (const name of fs.readdirSync(full).sort()) {
    if (!name.endsWith('.json')) continue
    try {
      out.push({ source: `${dir}/${name}`, hooks: JSON.parse(fs.readFileSync(path.join(full, name), 'utf8')).hooks ?? {} })
    } catch {
      // La auditoría la reporta; el instalador no se cae a mitad de camino.
      out.push({ source: `${dir}/${name}`, hooks: null })
    }
  }
  return out
}

const MODE = /^[a-z]+$/

/**
 * El modo de `icm hook <modo>` que un comando termina corriendo, o null: sea
 * directo (`/ruta/icm [--db x] hook prompt`) o por `icm-hook.sh prompt`.
 */
export function icmMode(command) {
  const tokens = String(command ?? '')
    .trim()
    .split(/\s+/)
    .map((t) => path.basename(t.replace(/["']/g, '')))
  for (let i = 0; i < tokens.length - 1; i++) {
    if (/^icm-hook\.(sh|ps1)$/.test(tokens[i]) && MODE.test(tokens[i + 1])) return tokens[i + 1]
    if (tokens[i] !== 'icm') continue
    const hook = tokens.indexOf('hook', i + 1)
    if (hook !== -1 && MODE.test(tokens[hook + 1] ?? '')) return tokens[hook + 1]
  }
  return null
}

/** `bash <script> <resto>` → { script, rest }, con el script sin comillas. */
export function scriptOf(command) {
  const m = /^\s*(?:bash|sh)\s+("[^"]+"|'[^']+'|\S+)(.*)$/.exec(command ?? '')
  if (!m) return null
  return { script: m[1].replace(/^["']|["']$/g, ''), rest: m[2] }
}

export const isRelative = (p) => !/^(\/|~|\$)/.test(p)

/** Una entrada en dialecto Copilot → { event, matcher, command, timeout } para Claude Code. */
export function claudeEntry(event, entry) {
  const s = scriptOf(entry.command)
  if (!s || !isRelative(s.script)) {
    return { event, matcher: MATCHER[event], command: entry.command, timeout: entry.timeout }
  }
  const rel = s.script.replace(/^\.\//, '')
  const dialect = CLAUDE_DIALECT[rel] ? ` ${CLAUDE_DIALECT[rel]}` : ''
  const claudeEvent = CLAUDE_EVENT[rel] ?? event
  const untimed = rel === ICM_HOOK && UNTIMED_MODES.has(icmMode(entry.command))
  return {
    event: claudeEvent,
    matcher: MATCHER[claudeEvent],
    command: `bash "${PROJECT_DIR}/${rel}"${s.rest}${dialect}`,
    timeout: untimed ? undefined : entry.timeout,
  }
}

/** Las entradas que sólo Claude Code recibe de los scripts que una declaración usa. */
function claudeOnlyEntries(hooks) {
  const used = new Set()
  for (const entries of Object.values(hooks)) {
    for (const e of entries ?? []) {
      const s = scriptOf(e?.command)
      if (s && isRelative(s.script)) used.add(s.script.replace(/^\.\//, ''))
    }
  }
  return [...used].flatMap((rel) => (CLAUDE_ONLY[rel] ?? []).map((x) => ({ event: x.event, entry: { command: `bash ${rel}${x.args}` } })))
}

/** Dónde lee Claude Code el settings de usuario; `CLAUDE_CONFIG_DIR` lo mueve (docs de settings). */
export function userSettingsPath(env = process.env) {
  return path.join(env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'settings.json')
}

/** Los hooks del scope de usuario. Sólo lectura: un archivo ilegible es un scope vacío. */
export function readUserHooks(file = userSettingsPath()) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')).hooks ?? {}
  } catch {
    return {}
  }
}

/** ¿El matcher de un grupo de usuario dispara para lo que matchea el proyecto? */
export function matcherCovers(user, project) {
  if (!user || user === '*') return true
  if (!project) return false
  try {
    return new RegExp(`^(?:${user})$`).test(project)
  } catch {
    return user === project
  }
}

// `icm init --force` existe porque una entrada puede apuntar a un binario que
// ya no está: esa entrada no inyecta nada, así que no cubre al proyecto. El
// binario se arma hasta el token `icm` y no hasta el primer espacio: un HOME
// con espacios partía la ruta y daba por muerto un binario vivo.
function binaryAlive(command) {
  const tokens = command.trim().split(/\s+/)
  const end = tokens.findIndex((t) => path.basename(t.replace(/["']/g, '')) === 'icm')
  const bin = tokens
    .slice(0, end === -1 ? 1 : end + 1)
    .join(' ')
    .replace(/["']/g, '')
  return !bin.startsWith('/') || fs.existsSync(bin)
}

/** Los modos de `icm hook` que el scope de usuario ya dispara para ese evento y matcher. */
export function userIcmModes(userHooks, event, matcher) {
  const modes = new Set()
  for (const group of userHooks?.[event] ?? []) {
    if (!matcherCovers(group?.matcher, matcher)) continue
    for (const h of group?.hooks ?? []) {
      const mode = h?.command ? icmMode(h.command) : null
      if (mode && binaryAlive(h.command)) modes.add(mode)
    }
  }
  return modes
}

/**
 * Cada entrada declarada, traducida a Claude Code. No depende de la máquina:
 * dos máquinas con el mismo árbol escriben el mismo `.claude/settings.json`.
 */
export function planClaude(declarations) {
  const plan = []
  for (const { source, hooks } of declarations) {
    if (!hooks) continue
    const declared = Object.entries(hooks).flatMap(([event, entries]) => (entries ?? []).map((entry) => ({ event, entry })))
    for (const { event, entry } of [...declared, ...claudeOnlyEntries(hooks)]) {
      if (!entry?.command) continue
      plan.push({ source, declared: entry.command, ...claudeEntry(event, entry), icmMode: icmMode(entry.command) })
    }
  }
  return plan
}

/** ¿El comando se omite solo cuando el scope de usuario ya dispara su modo? */
export const dedupsAtRuntime = (command) => /icm-hook\.sh["']?\s+[a-z]+\s+claude\s*$/.test(command ?? '')

/** Los handlers de un settings de Claude Code, aplanados. */
export function settingsHandlers(settings) {
  const out = []
  for (const [event, groups] of Object.entries(settings?.hooks ?? {})) {
    for (const group of Array.isArray(groups) ? groups : []) {
      for (const h of group?.hooks ?? []) {
        if (h?.command) out.push({ event, matcher: group.matcher, command: h.command })
      }
    }
  }
  return out
}

/** El binario de icm que correría un hook, o null. Los candidatos son los de `icm-hook.sh`. */
export function findIcm(env = process.env) {
  const dirs = [...(env.PATH ?? '').split(path.delimiter), '/opt/homebrew/bin', '/usr/local/bin', path.join(os.homedir(), '.local/bin')]
  for (const dir of dirs) {
    if (!dir) continue
    const candidate = path.join(dir, 'icm')
    try {
      fs.accessSync(candidate, fs.constants.X_OK)
      return candidate
    } catch {
      // siguiente candidato
    }
  }
  return null
}
