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
 */

import fs from 'node:fs'
import path from 'node:path'
import {
  CLAUDE_SETTINGS,
  isRelative,
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

/** El mismo `icm hook <modo>` disparado desde los dos scopes en el mismo evento. */
export function duplicateInjections(userHooks, projectHandlers) {
  const dups = []
  for (const h of projectHandlers) {
    const mode = icmMode(h.command)
    if (mode && userIcmModes(userHooks, h.event, h.matcher).has(mode)) dups.push({ event: h.event, mode, command: h.command })
  }
  return dups
}

/**
 * @param {string} root
 * @param {{ userHooks?: object, installed?: boolean }} [opts]
 *   `installed`: un instalador corrió acá y prometió el cableado de ICM.
 */
export function auditHookWiring(root, { userHooks = readUserHooks(), installed = false } = {}) {
  const declarations = readDeclarations(root)
  const handlers = settingsHandlers(readJson(path.join(root, CLAUDE_SETTINGS)))
  const r = { declared: declarations.map((d) => d.source), wired: [], orphaned: [], broken: [], unwiredIcm: [], delegated: [] }

  for (const d of declarations) {
    for (const cmd of Object.values(d.hooks ?? {}).flat().map((e) => e?.command).filter(Boolean)) {
      const s = scriptOf(cmd)
      if (!s || !isRelative(s.script)) continue
      const problem = scriptProblem(path.join(root, s.script))
      if (problem) r.broken.push(`${d.source} → ${s.script} ${problem}`)
    }

    // Una declaración vacía no está "cableada" por vacuidad, y media cadena de
    // hooks es una regla que dispara a veces: las dos cuentan como huérfanas.
    const plan = planClaude([d], { userHooks })
    let missing = plan.length === 0
    for (const p of plan) {
      if (p.status === 'user-scope') r.delegated.push(`${d.source} → ${p.event}: icm hook ${p.icmMode}`)
      else if (handlers.some((h) => h.event === p.event && h.command === p.command)) continue
      // Sin `icm init --mode hook` en esta máquina, el cableado de ICM depende
      // de que corra install-hooks acá. En CI o en un clon fresco eso no es un
      // defecto del árbol; en un workspace instalado sí, porque se prometió.
      else if (p.icmMode && !installed) r.unwiredIcm.push(`${d.source} → ${p.event}: icm hook ${p.icmMode}`)
      else missing = true
    }
    ;(missing ? r.orphaned : r.wired).push(d.source)
  }

  r.violations = claudeViolations(handlers, root)
  r.duplicates = duplicateInjections(userHooks, handlers)
  return r
}
