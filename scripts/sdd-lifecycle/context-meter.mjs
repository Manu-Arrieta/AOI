#!/usr/bin/env node
/**
 * scripts/sdd-lifecycle/context-meter.mjs
 *
 * Hook de UserPromptSubmit: mide el contexto de la sesión y, al cruzar el umbral,
 * aconseja en UNA línea cerrar la fase SDD y seguir la próxima en un contexto nuevo.
 *
 * Medido el 2026-10-01 sobre 110 sesiones principales reales de este repositorio: un
 * request de la sesión principal relee 359k tokens de promedio contra 86k uno de
 * subagente, y una sola sesión —un ciclo largo hecho entero en un contexto— releyó
 * 1.101M tokens en 2.386 requests, el 76 % del total. El 86,4 % de lo releído era
 * conversación acumulada. Nada le avisaba al Owner ni al modelo que la sesión ya
 * costaba por request más que un subagente con todo su contrato de entrada, y la
 * continuidad no necesita el chat: la entrada de cada fase son los artefactos de
 * `.tasks/` y los facts que verifica `aoi:handoffs`.
 *
 * Cuesta 0 tokens hasta que dispara: sin cruce no imprime nada. Nunca hace fallar el
 * prompt: cualquier error es un exit 0 mudo. El estado por sesión (offset del
 * transcript y último nivel avisado) es un archivo chico; sin id de sesión no se mide.
 *
 * Salida: `systemMessage` (lo ve el usuario, en Claude Code y en Copilot) y
 * `hookSpecificOutput.additionalContext` (lo lee el modelo; Claude Code lo inyecta y
 * Copilot no lo admite en UserPromptSubmit, según su referencia de hooks).
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { effectiveModel, measure, scanTranscript } from './context-transcript.mjs'
import { resolveWindow, thresholdFor } from './context-window.mjs'

/** Tras el primer aviso, otro cada vez que el contexto crece un 50 % más. */
export const REFIRE = 1.5

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export const defaultStateDir = (env = process.env) =>
  env.AOI_CONTEXT_METER_DIR || path.join(os.tmpdir(), 'aoi-context-meter')

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 32)

/** La clave del estado: el id de sesión de cualquiera de los dos harnesses, o el transcript. */
export function sessionKey(input) {
  const id = input?.session_id ?? input?.sessionId
  if (typeof id === 'string' && id) return /^[A-Za-z0-9_.-]{1,128}$/.test(id) && !/^\.+$/.test(id) ? id : sha(id)
  const t = transcriptOf(input)
  return t ? `t-${sha(t)}` : null
}

const transcriptOf = (input) => {
  const t = input?.transcript_path ?? input?.transcriptPath
  return typeof t === 'string' && t ? t : null
}

/**
 * Nivel alcanzado: 0 al cruzar el umbral, 1 al 1,5×, 2 al 2,25×… Avisa sólo al subir de
 * nivel. Bajar del umbral (una compactación) rearma el aviso.
 */
export function crossing(tokens, threshold, lastLevel = -1) {
  if (!(threshold > 0) || tokens < threshold) return { fire: false, level: -1 }
  const level = Math.floor(Math.log(tokens / threshold) / Math.log(REFIRE) + 1e-9)
  return { fire: level > lastLevel, level: Math.max(level, lastLevel) }
}

const fmt = (n) => (n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(2)}M` : `${Math.round(n / 1000)}k`)

/** La línea de aviso. Corta a propósito: cada byte se relee en cada request posterior. */
export function adviceLine({ tokens, source, threshold, window, windowSource }) {
  return (
    `[aoi] Contexto ≈${fmt(tokens)} tokens (${source}) ≥ umbral ${fmt(threshold)} (ventana ${fmt(window)}, ${windowSource}). ` +
    'Hacé checkpoint en ICM, cerrá la fase SDD actual y seguí la próxima en un contexto nuevo o subagente: ' +
    'su entrada son los artefactos de .tasks/ (contrato de aoi:handoffs).'
  )
}

function readState(file) {
  try {
    const s = JSON.parse(fs.readFileSync(file, 'utf8'))
    return s && typeof s === 'object' ? s : {}
  } catch {
    return {}
  }
}

function writeState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(state))
  fs.renameSync(tmp, file)
}

/**
 * Los modelos declarados (con su `maxInputTokens`) y los asignados. Se cargan sólo si el
 * transcript no trae un modelo Anthropic, y una vez por sesión: el resultado queda en el
 * estado. `icm` se consulta en modo lectura; si no responde, no hay asignación.
 */
export async function loadDeclared(root = ROOT) {
  const { discoverProviders } = await import('../multi-harness/provider-config.mjs')
  const entries = discoverProviders().entries.map(({ id, name, vendor, maxInputTokens }) => ({ id, name, vendor, maxInputTokens }))
  let assigned = []
  try {
    const store = await import('../multi-harness/provider-store.mjs')
    const r = store.readAssignment(store.defaultWorkspace(root))
    if (r.ok) assigned = r.assignment.default ? [r.assignment.default] : store.storedSlots(r.assignment).map((s) => s.value)
  } catch {
    // sin icm: sin asignación
  }
  return { entries, assigned }
}

/**
 * Un disparo del hook. Devuelve lo que va a stdout ('' si no hay nada que decir).
 * @param {string} text  el JSON que el harness pasa por stdin
 */
export async function runHook(text, { stateDir = defaultStateDir(), declaredLoader = loadDeclared } = {}) {
  let input
  try {
    input = JSON.parse(text)
  } catch {
    return ''
  }
  if (!input || typeof input !== 'object') return ''
  const key = sessionKey(input)
  if (!key) return ''

  const file = path.join(stateDir, `${key}.json`)
  const state = readState(file)
  const transcript = transcriptOf(input)
  let scan = null
  if (transcript && fs.existsSync(transcript)) {
    scan = scanTranscript(transcript, state.scan ?? null)
    state.scan = scan
  } else if (typeof input.prompt === 'string') {
    state.observedBytes = (state.observedBytes ?? 0) + Buffer.byteLength(input.prompt)
  }

  const { tokens, source } = measure(scan, state.observedBytes)
  const model = effectiveModel(scan)
  if (!(model && /^claude/i.test(model)) && !state.declared) state.declared = await declaredLoader()
  const { window, source: windowSource } = resolveWindow({ model, maxUsage: scan?.maxUsage ?? 0 }, state.declared ?? {})
  const threshold = thresholdFor(window)
  const { fire, level } = crossing(tokens, threshold, state.level ?? -1)
  state.level = level
  writeState(file, state)
  if (!fire) return ''

  const line = adviceLine({ tokens, source, threshold, window, windowSource })
  return JSON.stringify({
    systemMessage: line,
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: line },
  })
}

async function readStdin() {
  if (process.stdin.isTTY) return ''
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  return Buffer.concat(chunks).toString('utf8')
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length !== 1 || args[0] !== '--hook') {
    console.error('Uso: context-meter.mjs --hook   (lee por stdin el JSON de UserPromptSubmit)')
    process.exit(2)
  }
  let out = ''
  try {
    out = await runHook(await readStdin())
  } catch {
    out = ''
  }
  if (out) process.stdout.write(`${out}\n`)
  process.exit(0)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch(() => process.exit(0))
}
