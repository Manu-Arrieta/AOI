/**
 * scripts/multi-harness/hook-wiring-audit.mjs
 *
 * `aoi:hooks`: ¿cada declaración de `.github/hooks/` llega a Claude Code, y
 * llega de una forma que funciona?
 *
 * La versión anterior comparaba CADENAS —"¿el comando declarado aparece en el
 * settings?"— y dio verde sobre la configuración que, en 111 transcripts
 * reales, falló 42-43 veces × 4 hooks por rutas relativas, pidió permiso en cada
 * comando que RTK reescribía, corrió el cierre de sesión en cada turno e
 * inyectó dos veces el mismo `icm hook prompt` (~67k tokens). Cada regla de
 * `claudeViolations` es uno de esos defectos; la duplicación entre scopes es un
 * aviso, con los bytes medidos, porque el scope de usuario no es de AOI.
 *
 * Una declaración cuenta como cableada sólo si el settings del PROYECTO la
 * lleva. La versión anterior daba ✅ a una de ICM que no cableaba nadie —la
 * guardaba aparte, sin marcarla faltante— y el archivo versionado, generado en
 * una máquina con `icm init --mode hook`, no llevaba ningún hook de ICM: en un
 * clon sin ese scope de usuario Claude Code corría sin ICM y la auditoría
 * salía 0. Que el scope de usuario ya dispare un modo lo resuelve
 * `icm-hook.sh` al disparar, no la configuración.
 */

import fs from 'node:fs'
import path from 'node:path'
import {
  CLAUDE_SETTINGS,
  isRelative,
  dedupsAtRuntime,
  planClaude,
  readDeclarations,
  readUserHooks,
  scriptOf,
  settingsHandlers,
  userIcmModes,
  icmMode,
} from './claude-hook-plan.mjs'

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

function scriptProblem(file) {
  if (!fs.existsSync(file)) return 'no existe'
  try {
    fs.accessSync(file, fs.constants.X_OK)
    return null
  } catch {
    return 'no es ejecutable'
  }
}

/** Lo que hace fallar o molestar a un hook YA cableado en Claude Code. */
export function claudeViolations(handlers, root) {
  const out = []
  for (const { event, command } of handlers) {
    const where = `${CLAUDE_SETTINGS} → ${event}: ${command}`
    const s = scriptOf(command)
    const first = s?.script ?? command.trim().split(/\s+/)[0]
    if (first.includes('/') && isRelative(first)) {
      out.push(`${where} — ruta relativa: falla en cuanto el cwd sale de la raíz (usar "\${CLAUDE_PROJECT_DIR}")`)
    }
    if (/\brtk\s+hook\s+copilot\b/.test(command) || (/rtk-hook\.sh/.test(command) && !/\sclaude\s*$/.test(command))) {
      out.push(`${where} — dialecto de Copilot: "permissionDecision: ask" pide permiso en cada comando reescrito`)
    }
    if (event === 'Stop' && /session-close-hook/.test(command)) {
      out.push(`${where} — Stop corre en cada turno; el cierre de sesión es SessionEnd`)
    }
    if (s?.script.startsWith('$')) {
      const full = s.script.replace(/^\$\{CLAUDE_PROJECT_DIR(?::-[^}]*)?\}|^\$CLAUDE_PROJECT_DIR/, root)
      const problem = scriptProblem(full)
      if (problem) out.push(`${where} — el script ${problem}`)
    }
  }
  return out
}

/**
 * El mismo `icm hook <modo>` disparado desde los dos scopes en el mismo evento.
 * `icm-hook.sh <modo> claude` no cuenta: se omite solo al disparar.
 */
export function duplicateInjections(userHooks, projectHandlers) {
  const dups = []
  for (const h of projectHandlers) {
    const mode = icmMode(h.command)
    if (!mode || dedupsAtRuntime(h.command)) continue
    if (userIcmModes(userHooks, h.event, h.matcher).has(mode)) dups.push({ event: h.event, mode, command: h.command })
  }
  return dups
}

/** @param {string} root @param {{ userHooks?: object }} [opts] */
export function auditHookWiring(root, { userHooks = readUserHooks() } = {}) {
  const declarations = readDeclarations(root)
  const handlers = settingsHandlers(readJson(path.join(root, CLAUDE_SETTINGS)))
  const r = { declared: declarations.map((d) => d.source), wired: [], orphaned: [], missing: [], broken: [], userScopeOnly: [], skippedAtRuntime: [] }

  for (const d of declarations) {
    for (const cmd of Object.values(d.hooks ?? {}).flat().map((e) => e?.command).filter(Boolean)) {
      const s = scriptOf(cmd)
      if (!s || !isRelative(s.script)) continue
      const problem = scriptProblem(path.join(root, s.script))
      if (problem) r.broken.push(`${d.source} → ${s.script} ${problem}`)
    }

    // Una declaración vacía no está "cableada" por vacuidad, y media cadena de
    // hooks es una regla que dispara a veces: las dos cuentan como huérfanas.
    const plan = planClaude([d])
    let missing = plan.length === 0
    for (const p of plan) {
      const covered = p.icmMode !== null && userIcmModes(userHooks, p.event, p.matcher).has(p.icmMode)
      const what = `${d.source} → ${p.event}: ${p.icmMode ? `icm hook ${p.icmMode}` : p.command}`
      if (handlers.some((h) => h.event === p.event && h.command === p.command)) {
        if (covered && dedupsAtRuntime(p.command)) r.skippedAtRuntime.push(what)
        continue
      }
      missing = true
      // Esta máquina lo cubre; un clon sin `icm init --mode hook`, no.
      ;(covered ? r.userScopeOnly : r.missing).push(what)
    }
    ;(missing ? r.orphaned : r.wired).push(d.source)
  }

  r.violations = claudeViolations(handlers, root)
  r.duplicates = duplicateInjections(userHooks, handlers)
  return r
}
