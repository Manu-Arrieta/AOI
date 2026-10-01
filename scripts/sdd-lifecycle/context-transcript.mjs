/**
 * scripts/sdd-lifecycle/context-transcript.mjs
 *
 * Cuánto contexto lleva una sesión, leído de su transcript (`transcript_path` del
 * hook), de forma incremental.
 *
 * Incremental porque el hook corre en CADA prompt y el transcript crece sin parar:
 * medido el 2026-10-01, el más grande de este repositorio pesa 30 MB. Releerlo entero
 * por prompt costaría cientos de ms cada vez; guardando el offset, cada disparo lee sólo
 * lo que se agregó desde el anterior.
 *
 * Medidas, y el resultado dice cuál usó:
 *   - exacta: Claude Code guarda el `usage` de Anthropic en cada mensaje del asistente;
 *     el contexto del último request es input + cache_read + cache_creation. Copilot la
 *     guarda en su log de depuración (`context-copilot.mjs`).
 *   - sin medida: un transcript de Copilot sin su log no permite ni una cota inferior
 *     (`context-copilot.mjs`); se reconoce para no contarlo como bytes.
 *   - estimada: sin `usage` (otro harness, otro formato) se suman los bytes del contenido
 *     de los mensajes y se dividen por 4. Una línea que no es JSON cuenta entera.
 */

import fs from 'node:fs'
import { isCopilotRecord } from './context-copilot.mjs'
import { readLines } from './jsonl-lines.mjs'

export const BYTES_PER_TOKEN = 4

/** El estado de lectura de un transcript que todavía no se leyó. */
export function emptyScan(file = null) {
  return { file, offset: 0, contentBytes: 0, usage: null, maxUsage: 0, model: null, identity: null, format: null, skipped: false, jsonl: false }
}

export const usageTotal = (u) =>
  (u?.input_tokens ?? 0) + (u?.cache_read_input_tokens ?? 0) + (u?.cache_creation_input_tokens ?? 0)

const bytesOf = (v) => (v === undefined || v === null ? 0 : Buffer.byteLength(typeof v === 'string' ? v : JSON.stringify(v)))

// Un registro de Claude Code sin `message` (snapshots de archivos, títulos, modos) no
// entra al contexto del modelo; sí entran sus adjuntos con texto (salidas de hooks,
// recordatorios). Un registro de otro formato cuenta entero: no se sabe qué parte llega.
const isClaudeRecord = (rec) => 'uuid' in rec || 'sessionId' in rec || 'leafUuid' in rec

/** Aplica una línea del transcript al estado. Muta `scan`. */
export function scanLine(scan, line) {
  let rec
  try {
    rec = JSON.parse(line)
  } catch {
    rec = null
  }
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
    scan.contentBytes += Buffer.byteLength(line)
    return
  }
  // Después de compactar, lo de antes ya no está en el contexto.
  if (rec.type === 'system' && rec.subtype === 'compact_boundary') {
    scan.contentBytes = 0
    scan.usage = null
    return
  }
  if (isCopilotRecord(rec)) {
    scan.format = 'copilot'
    return
  }
  if (rec.attachment?.type === 'model' && typeof rec.attachment.identity?.modelId === 'string') {
    scan.identity = rec.attachment.identity.modelId
  }
  // Las líneas de un subagente (transcripts viejos las mezclaban) son otro contexto.
  if (rec.isSidechain === true) return
  const msg = rec.message
  if (msg && typeof msg === 'object') {
    scan.contentBytes += bytesOf(msg.content)
    const synthetic = msg.model === '<synthetic>'
    if (typeof msg.model === 'string' && !synthetic) scan.model = msg.model
    const total = synthetic ? 0 : usageTotal(msg.usage)
    if (total > 0) {
      scan.usage = total
      scan.maxUsage = Math.max(scan.maxUsage, total)
    }
    return
  }
  scan.contentBytes += isClaudeRecord(rec) ? bytesOf(rec.attachment?.content ?? rec.attachment?.text) : bytesOf(rec)
}

/**
 * El modelo en uso: el id del adjunto `model` (trae `[1m]`) si es el mismo modelo que el
 * último mensaje; si el modelo cambió (`/model`), el del mensaje.
 */
export function effectiveModel(scan) {
  if (!scan) return null
  const base = (id) => String(id).replace(/\[[^\]]*\]$/, '')
  if (scan.identity && (!scan.model || base(scan.identity) === scan.model)) return scan.identity
  return scan.model
}

/**
 * Lee del transcript lo que se agregó desde `prev.offset`, por bloques y con tope
 * (`jsonl-lines.mjs`). Un archivo más chico que el offset fue reescrito: se relee desde
 * cero. Sólo se consumen líneas completas.
 */
export function scanTranscript(file, prev = null) {
  const size = fs.statSync(file).size
  const scan = prev && prev.file === file && size >= prev.offset ? { ...prev } : emptyScan(file)
  if (size === scan.offset) return scan
  const r = readLines(file, scan.offset, (line) => scanLine(scan, line))
  if (r.skipped) scan.skipped = true
  if (r.newline) scan.jsonl = true
  if (!scan.jsonl) {
    // Sin saltos de línea nunca no es JSONL: un documento que se reescribe entero.
    // Cuenta lo que creció.
    scan.contentBytes += size - scan.offset
    scan.offset = size
    return scan
  }
  scan.offset = r.offset
  return scan
}

/**
 * El contexto actual en tokens y cómo se obtuvo, del más exacto al menos. Sin
 * transcript queda lo único que el hook ve: los prompts, que son una cota inferior.
 * @param {object|null} debug  el estado del log de depuración de Copilot, si hay
 */
export function measure(scan, observedBytes = 0, debug = null) {
  if (debug && debug.usage !== null) return { tokens: debug.usage, source: 'exacto: inputTokens del log de Copilot', exact: true }
  if (scan?.usage) return { tokens: scan.usage, source: 'exacto: usage del transcript', exact: true }
  if (scan) {
    const tokens = Math.round(scan.contentBytes / BYTES_PER_TOKEN)
    if (scan.format === 'copilot') return { tokens: 0, source: 'sin medida: Copilot sin log de depuración', exact: false }
    return { tokens, source: `estimado: bytes del transcript/4${scan.skipped ? ', cola' : ''}`, exact: false }
  }
  return { tokens: Math.round(observedBytes / BYTES_PER_TOKEN), source: 'estimado: prompts observados/4, cota inferior', exact: false }
}
