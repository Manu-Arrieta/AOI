#!/usr/bin/env node
/**
 * scripts/conf/copilot-cli-icm-hooks.mjs
 *
 * Los cuatro hooks de ICM que Copilot CLI recibía de `icm init --mode hook`,
 * escritos por AOI en su settings de usuario.
 *
 * setup.sh dejó de correr ese init porque registraba los seis modos también
 * en el scope de usuario de Claude Code, donde `icm-hook.sh` se hacía a un lado
 * y su filtro de recall por sesión no corría nunca. Pero el mismo init era lo
 * único que le daba ICM a Copilot CLI: verificado por el orquestador, los
 * hooks de ~/.copilot/settings.json disparan en `copilot -p` y los de
 * `.github/hooks/` del repo —en los dos formatos— no dispararon desde un repo
 * no confiado. Sin esto, una instalación nueva dejaba a Copilot CLI sin ICM.
 *
 * Fusiona y nunca reescribe: otras claves y entradas quedan como estaban, un
 * evento que ya corre `icm hook <modo>` no se toca (como `icm init` sin
 * `--force`), y un archivo que no parsea no se escribe. Con `AOI_ICM_DB` no
 * hace nada: la instalación aislada no toca configuración global.
 *
 *   node scripts/conf/copilot-cli-icm-hooks.mjs --icm <ruta absoluta> [--settings <settings.json>]
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Lo que `icm init --mode hook` escribió en ~/.copilot/settings.json (leído de esta máquina). */
export const COPILOT_CLI_HOOKS = Object.freeze([
  ['sessionStart', 'start', 10],
  ['preToolUse', 'pre', 5],
  ['postToolUse', 'post', 10],
  ['userPromptSubmitted', 'prompt', 10],
])

/** Copilot CLI lee su configuración de `$COPILOT_HOME` o, sin ella, de ~/.copilot (docs de GitHub). */
export function copilotSettingsPath(env = process.env) {
  return path.join(env.COPILOT_HOME || path.join(env.HOME || os.homedir(), '.copilot'), 'settings.json')
}

const runsMode = (entry, mode) =>
  [entry?.bash, entry?.command].some((c) => typeof c === 'string' && new RegExp(`(^|[/\\s"'])icm["']?(\\s+-\\S+(\\s+[^-\\s]\\S*)?)*\\s+hook\\s+${mode}(\\s|$)`).test(c))

/**
 * El settings con los hooks que falten, o por qué no se toca.
 * @returns {{ settings?: object, added: string[], skipped: string[], error?: string }}
 */
export function mergeCopilotHooks(current, icmBin) {
  if (current === null || typeof current !== 'object' || Array.isArray(current)) return { added: [], skipped: [], error: 'no es un objeto JSON' }
  const hooks = current.hooks ?? {}
  if (typeof hooks !== 'object' || Array.isArray(hooks)) return { added: [], skipped: [], error: '"hooks" no es un objeto' }
  const next = { ...hooks }
  const added = []
  const skipped = []
  for (const [event, mode, timeoutSec] of COPILOT_CLI_HOOKS) {
    const entries = next[event] ?? []
    if (!Array.isArray(entries)) return { added: [], skipped: [], error: `"hooks.${event}" no es una lista` }
    if (entries.some((e) => runsMode(e, mode))) {
      skipped.push(event)
      continue
    }
    // Citado sólo con espacios: así queda byte a byte lo que escribía icm init,
    // y un HOME con espacios no parte el comando.
    const bin = /\s/.test(icmBin) ? JSON.stringify(icmBin) : icmBin
    next[event] = [...entries, { type: 'command', bash: `${bin} hook ${mode}`, timeoutSec }]
    added.push(event)
  }
  return { settings: { ...current, hooks: next }, added, skipped }
}

/** @returns {{ status: 'written'|'unchanged'|'skipped'|'refused', message: string }} */
export function ensureCopilotHooks({ file, icmBin, env = process.env }) {
  if (env.AOI_ICM_DB) return { status: 'skipped', message: 'ICM aislado (AOI_ICM_DB): Copilot CLI no se toca' }
  if (!path.isAbsolute(icmBin ?? '')) return { status: 'refused', message: `--icm necesita una ruta absoluta (recibió "${icmBin ?? ''}")` }
  let current = {}
  if (fs.existsSync(file)) {
    try {
      current = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      return { status: 'refused', message: `${file} no es JSON válido: no se toca` }
    }
  }
  const r = mergeCopilotHooks(current, icmBin)
  if (r.error) return { status: 'refused', message: `${file}: ${r.error}; no se toca` }
  if (r.added.length === 0) return { status: 'unchanged', message: `Copilot CLI ya tenía los hooks de ICM (${file})` }
  // El rename atómico reemplazaba un settings.json enlazado (dotfiles) por un
  // archivo común y dejaba en 644 uno que estaba en 600: se escribe sobre el
  // destino del enlace y con el modo que tenía.
  const target = fs.existsSync(file) ? fs.realpathSync(file) : file
  const mode = fs.existsSync(target) ? fs.statSync(target).mode & 0o777 : null
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const tmp = `${target}.aoi-tmp-${process.pid}`
  fs.writeFileSync(tmp, `${JSON.stringify(r.settings, null, 2)}\n`)
  if (mode !== null) fs.chmodSync(tmp, mode)
  fs.renameSync(tmp, target)
  return { status: 'written', message: `Copilot CLI → hooks de ICM: ${r.added.join(', ')} (${file})` }
}

function main(argv) {
  const opts = {}
  for (let i = 0; i < argv.length; i++) {
    const key = { '--icm': 'icm', '--settings': 'settings' }[argv[i]]
    if (!key || argv[i + 1] === undefined) {
      console.error(`argumento desconocido o sin valor: ${argv[i]}\nUso: copilot-cli-icm-hooks.mjs --icm <ruta absoluta> [--settings <settings.json>]`)
      return 2
    }
    opts[key] = argv[++i]
  }
  const r = ensureCopilotHooks({ file: opts.settings ?? copilotSettingsPath(), icmBin: opts.icm })
  console.log(r.message)
  return r.status === 'refused' ? 1 : 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exit(main(process.argv.slice(2)))
}
