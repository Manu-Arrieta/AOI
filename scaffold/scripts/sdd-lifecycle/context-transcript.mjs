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
 * Dos medidas, y el resultado dice cuál usó:
 *   - exacta: Claude Code guarda el `usage` de Anthropic en cada mensaje del asistente;
 *     el contexto del último request es input + cache_read + cache_creation.
 *   - estimada: sin `usage` (otro harness, otro formato) se suman los bytes del contenido
 *     de los mensajes y se dividen por 4. Una línea que no es JSON cuenta entera.
 */

import fs from 'node:fs'

export const BYTES_PER_TOKEN = 4

/** El estado de lectura de un transcript que todavía no se leyó. */
export function emptyScan(file = null) {
  return { file, offset: 0, contentBytes: 0, usage: null, maxUsage: 0, model: null, identity: null }
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
 * Lee del transcript lo que se agregó desde `prev.offset`. Un archivo más chico que el
 * offset fue reescrito: se relee desde cero. Sólo se consumen líneas completas.
 */
export function scanTranscript(file, prev = null) {
  const size = fs.statSync(file).size
  const scan = prev && prev.file === file && size >= prev.offset ? { ...prev } : emptyScan(file)
  if (size === scan.offset) return scan
  const buf = Buffer.alloc(size - scan.offset)
  const fd = fs.openSync(file, 'r')
  try {
    fs.readSync(fd, buf, 0, buf.length, scan.offset)
  } finally {
    fs.closeSync(fd)
  }
  const end = buf.lastIndexOf(10)
  if (end === -1) {
    // Sin saltos de línea no es JSONL: un documento que se reescribe entero. Cuenta lo
    // que creció.
    scan.contentBytes += buf.length
    scan.offset = size
    return scan
  }
  for (const line of buf.subarray(0, end).toString('utf8').split('\n')) if (line) scanLine(scan, line)
  scan.offset += end + 1
  return scan
}

/**
 * El contexto actual en tokens y cómo se obtuvo. Sin transcript queda lo único que el
 * hook ve: los prompts, que son una cota inferior.
 */
export function measure(scan, observedBytes = 0) {
  if (scan?.usage) return { tokens: scan.usage, source: 'exacto: usage del transcript' }
  if (scan) return { tokens: Math.round(scan.contentBytes / BYTES_PER_TOKEN), source: 'estimado: bytes del transcript/4' }
  return { tokens: Math.round(observedBytes / BYTES_PER_TOKEN), source: 'estimado: prompts observados/4, cota inferior' }
}
