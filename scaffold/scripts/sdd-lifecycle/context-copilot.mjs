/**
 * scripts/sdd-lifecycle/context-copilot.mjs
 *
 * El contexto de una sesión de Copilot (VS Code), que es por donde corren los
 * proveedores customendpoint declarados.
 *
 * Medido el 2026-10-01 sobre los 225 transcripts de Copilot de esta máquina
 * (`GitHub.copilot-chat/transcripts/<sesión>.jsonl`): los registros son
 * `{type, data, id, timestamp, parentId}`, sin `message`, sin `usage`, sin modelo y sin
 * marca de resumen; `tool.execution_complete` trae sólo `{success, toolCallId}` (los
 * resultados de las tools no están), y los argumentos de cada tool aparecen dos veces
 * (`assistant.message.toolRequests` y `tool.execution_start`). La primera versión del
 * medidor contaba cada registro entero, sobre envoltorio y duplicados, sin poder bajar
 * nunca: estimó ≈8,45M tokens en una sesión y disparó 529 veces en 127 de 225 sesiones.
 *
 * Del transcript solo no sale ni una cota inferior: Copilot poda historia sin dejar
 * marca. Contra la cuenta exacta de 1.885 prompts, los bytes/4 de sólo los prompts del
 * usuario la superaron en 45 (17 sin ningún resumen previo) y los del último turno
 * solo, en 2. Por eso una sesión de Copilot sin log de depuración no se mide ni avisa;
 * el log está en las 174 sesiones de Copilot 0.48 en adelante, y falta sólo en 30 de
 * versiones anteriores.
 *
 * La cuenta exacta existe al lado: `GitHub.copilot-chat/debug-logs/<sesión>/main.jsonl`
 * (195 de esas 225 sesiones lo tienen) registra cada `llm_request` con `model`,
 * `debugName` e `inputTokens` (`cachedTokens` nunca lo supera: está incluido), los
 * resúmenes como `debugName: summarizeConversationHistory`, y su `models.json` trae
 * `max_prompt_tokens` de cada modelo que sirve Copilot. Los customendpoint pueden
 * compartir id con uno de Copilot (`kimi-k3` declarado sin ventana contra 917.501 de
 * models.json): su ventana sale de lo declarado, nunca de ese archivo
 * (`context-window.mjs`).
 */

import fs from 'node:fs'
import path from 'node:path'
import { readLines } from './jsonl-lines.mjs'

/** Un registro del transcript de Copilot: tiene `data` y `parentId`, no `uuid`. */
export const isCopilotRecord = (rec) => typeof rec.type === 'string' && 'data' in rec && 'parentId' in rec && !('uuid' in rec)

/** El log de depuración que corresponde a un transcript de Copilot, o null. */
export function debugLogFor(transcript) {
  const m = /^(.*)[/\\]GitHub\.copilot-chat[/\\]transcripts[/\\]([^/\\]+)\.jsonl$/.exec(String(transcript ?? ''))
  return m ? path.join(m[1], 'GitHub.copilot-chat', 'debug-logs', m[2], 'main.jsonl') : null
}

export const emptyDebug = (file = null) => ({ file, offset: 0, usage: null, maxUsage: 0, model: null, wrapper: false })

// Requests que no son el contexto de la conversación: los resúmenes releen la historia
// (o la lista de tools, `summarizeVirtualTools`) una vez para comprimirla, y el
// subagente de búsqueda tiene la suya.
const SIDE_REQUEST = /^summarize|subagent|^title/i

// Sólo este resumen reemplaza la historia. `summarizeVirtualTools` (3 requests medidos)
// resume la lista de tools y no vacía nada.
const HISTORY_SUMMARY = /^summarizeConversationHistory/i

// Los modelos que no sirve Copilot (customendpoint y demás proveedores declarados por el
// Owner) pasan por este wrapper: 8.479 requests medidos, de 11 ids: los 8 declarados hoy y 3 que hoy no figuran en la configuración.
// El log no nombra al proveedor: este nombre es la única señal de que el request no es
// de un modelo de Copilot.
export const WRAPPER = 'copilotLanguageModelWrapper'

const HEAD = 2048
// La cola que se lee de un log: alcanza para los últimos ~13 requests de 1,25 MB, y el
// medidor sólo necesita el último.
export const DEBUG_MAX_READ = 16 * 1024 * 1024

function field(head, key) {
  const m = new RegExp(`"${key}":("(?:[^"\\\\]|\\\\.)*")`).exec(head)
  try {
    return m ? JSON.parse(m[1]) : undefined
  } catch {
    return undefined
  }
}

/**
 * Los campos de un `llm_request`. Cada línea pesa hasta 1,25 MB porque trae los mensajes,
 * y parsear las de la cola de un log de 267 MB costó 230 ms y 254 MB de RSS por disparo
 * frío: en las 23.850 líneas medidas `status`, `model`, `debugName` e `inputTokens` están
 * siempre antes que `inputMessages`, así que se leen de la cabeza. Una clave escapada
 * dentro de un string (`\"inputTokens\":`) no calza con el patrón. Si la cabeza no los
 * trae, se parsea la línea entera.
 */
function requestOf(line, full) {
  const head = line.slice(0, HEAD)
  if (!head.includes('"llm_request"')) return null
  const tokens = /"inputTokens":(\d+)/.exec(head)
  if (tokens && /"type":"llm_request"/.test(head)) {
    return { status: field(head, 'status'), attrs: { inputTokens: Number(tokens[1]), debugName: field(head, 'debugName'), model: field(head, 'model') } }
  }
  try {
    const r = JSON.parse(full())
    return r?.type === 'llm_request' ? r : null
  } catch {
    return null
  }
}

/**
 * Aplica una línea del log de depuración. Muta `d`.
 * @param {string} line  la línea, o su cabeza
 * @param {() => string} [full]  la línea entera, si `line` es sólo la cabeza
 */
export function scanDebugLine(d, line, full = () => line) {
  const r = requestOf(line, full)
  if (!r || r.status === 'error') return
  const a = r.attrs ?? {}
  const name = typeof a.debugName === 'string' ? a.debugName : ''
  // Después de un resumen la historia ya no está: el próximo request dirá cuánto quedó.
  if (HISTORY_SUMMARY.test(name)) {
    d.usage = 0
    return
  }
  if (SIDE_REQUEST.test(name) || !(Number.isFinite(a.inputTokens) && a.inputTokens > 0)) return
  d.usage = a.inputTokens
  d.maxUsage = Math.max(d.maxUsage, a.inputTokens)
  if (typeof a.model === 'string' && a.model) d.model = a.model
  d.wrapper = name === WRAPPER
}

/** Lee del log de depuración lo agregado desde `prev.offset`. */
export function scanDebugLog(file, prev = null) {
  const size = fs.statSync(file).size
  const d = prev && prev.file === file && size >= prev.offset ? { ...prev } : emptyDebug(file)
  if (size === d.offset) return d
  d.offset = readLines(file, d.offset, (head, full) => scanDebugLine(d, head, full), { maxRead: DEBUG_MAX_READ, headBytes: HEAD }).offset
  return d
}

/** `max_prompt_tokens` de un modelo servido por Copilot, del `models.json` de la sesión. */
export function copilotPromptLimit(debugFile, model) {
  if (!debugFile || !model) return null
  try {
    const list = JSON.parse(fs.readFileSync(path.join(path.dirname(debugFile), 'models.json'), 'utf8'))
    const v = Array.isArray(list) ? list.find((m) => m?.id === model)?.capabilities?.limits?.max_prompt_tokens : null
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}
