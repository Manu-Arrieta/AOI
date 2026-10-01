/**
 * scripts/sdd-lifecycle/context-window.mjs
 *
 * La ventana del modelo en uso y el umbral a partir del cual `context-meter.mjs`
 * aconseja cortar la sesión.
 *
 * El umbral NO es "cerca del límite de la ventana". Medido el 2026-10-01 sobre 110
 * sesiones principales reales de Claude Code en este repositorio: un request de la
 * sesión principal relee 359k tokens de promedio y uno de subagente 86k; la sesión más
 * cara releyó 1.101M tokens en 2.386 requests con un pico de 966k (el 76 % de todas), y
 * el 86,4 % de lo releído era conversación acumulada, no prefijo fijo. Con la ventana de
 * 1M nunca se llegó al límite y igual fue la sesión más cara: el costo de un request es
 * lineal en el contexto que relee, sea cual sea la ventana. Por eso el umbral es la mitad
 * de la ventana CON UN TOPE ABSOLUTO de 200k: por encima de eso cada request paga más de
 * lo que paga uno de subagente con todo su contrato de entrada (86k medido) por más del
 * doble, y la ventana grande sólo agrega lugar para seguir pagando.
 *
 * Debe comportarse igual con todo proveedor declarado. Medido en la configuración real
 * de VS Code (11 modelos customendpoint de Nvidia, Alibaba, Zai, MiniMax, DeepSeek y
 * Kimi): 7 declaran `maxInputTokens` y 4 no. Un modelo sin ventana declarada no hereda
 * la de otro ni se supone grande: cae en 128k, la menor de las declaradas.
 */

import { subagentValue } from '../multi-harness/provider-config.mjs'

export const DEFAULT_WINDOW = 128_000
export const ANTHROPIC_WINDOW = 200_000
export const LONG_WINDOW = 1_000_000
export const ABSOLUTE_CAP = 200_000

/** El umbral de aviso para una ventana: la mitad, nunca más de 200k. */
export function thresholdFor(window) {
  return Math.min(Math.floor(window / 2), ABSOLUTE_CAP)
}

const declared = (entry) =>
  Number.isFinite(entry?.maxInputTokens) && entry.maxInputTokens > 0 ? entry.maxInputTokens : null

// El log de Copilot nombra al modelo sin el prefijo de vendor que lleva el id declarado
// (`deepseek-v4-pro` contra `deepseek-ai/deepseek-v4-pro`, medido el 2026-10-01).
const tail = (id) => String(id ?? '').split('/').pop()

/**
 * La entrada declarada que corresponde a un modelo, por `id`, por `name`, por el valor
 * que `runSubagent` acepta (`<name> (customendpoint)`, que es lo que guarda la
 * asignación) o, si es la única, por el id sin prefijo de vendor.
 */
export function findDeclared(model, entries = []) {
  const m = String(model ?? '').trim()
  if (!m) return null
  const exact = entries.find((e) => e.id === m || e.name === m || subagentValue(e) === m)
  if (exact) return exact
  const byTail = entries.filter((e) => e.id && tail(e.id) === tail(m))
  return byTail.length === 1 ? byTail[0] : null
}

/**
 * Un modelo de Anthropic por cualquier vía: la API directa y Copilot (`claude-…`),
 * Vertex (`claude-…@fecha`) y Bedrock, con o sin perfil regional
 * (`anthropic.claude-…`, `us.anthropic.claude-…`).
 */
export const isAnthropicModel = (model) => /^(?:(?:[a-z]{2,6}\.)?anthropic\.)?claude/i.test(String(model ?? ''))

/**
 * Ventana de un modelo Anthropic visto en el transcript. Claude Code escribe el id
 * pedido (`claude-opus-5-5[1m]`) sólo en el adjunto `model`; `message.model` llega sin
 * el sufijo. Un transcript viejo sin ese adjunto todavía delata la ventana larga si algún
 * request leyó más de 200k: con 200k eso no habría sido posible.
 */
export function anthropicWindow(model, maxUsage = 0) {
  if (/\[1m\]/i.test(model)) return { window: LONG_WINDOW, source: 'transcript: modelo [1m]' }
  if (maxUsage > ANTHROPIC_WINDOW) return { window: LONG_WINDOW, source: 'transcript: usage > 200k observado' }
  return { window: ANTHROPIC_WINDOW, source: 'transcript: modelo Anthropic' }
}

/**
 * La ventana del modelo en uso y de dónde sale, en este orden:
 *   1. la que el harness publica para ese modelo (`max_prompt_tokens` de Copilot);
 *   2. el modelo visto (Anthropic, o uno declarado con `maxInputTokens`);
 *   3. el modelo asignado (`assignment.default`, o el menor de los slots), por su
 *      `maxInputTokens` declarado;
 *   4. 128k.
 * Nunca es menor que el mayor request observado: si un request leyó más, la ventana es
 * al menos eso (Kimi K3 sin `maxInputTokens` declarado leyó 483.658 tokens en Copilot).
 *
 * @param {{ model?: string|null, maxUsage?: number, harnessWindow?: number|null }} seen
 * @param {{ entries?: object[], assigned?: string[] }} declaredCtx
 * @returns {{ window: number, source: string }}
 */
export function resolveWindow(seen = {}, declaredCtx = {}) {
  const r = baseWindow(seen, declaredCtx)
  const maxUsage = seen.maxUsage ?? 0
  return maxUsage > r.window ? { window: maxUsage, source: `${r.source}; request observado mayor` } : r
}

function baseWindow({ model, maxUsage = 0, harnessWindow = null }, { entries = [], assigned = [] }) {
  if (harnessWindow > 0) return { window: harnessWindow, source: 'Copilot: max_prompt_tokens del modelo' }
  const fromTranscript = model ? declared(findDeclared(model, entries)) : null
  if (fromTranscript) return { window: fromTranscript, source: 'modelo visto → maxInputTokens declarado' }
  if (model && isAnthropicModel(model)) return anthropicWindow(model, maxUsage)
  if (assigned.length > 0) {
    const windows = assigned.map((v) => declared(findDeclared(v, entries)))
    // Un slot sin ventana cuenta como 128k: el menor manda, porque no se sabe cuál de
    // los modelos asignados es el que está corriendo.
    const window = Math.min(...windows.map((w) => w ?? DEFAULT_WINDOW))
    const fromDefault = windows.some((w) => !w) && window === DEFAULT_WINDOW
    const source = fromDefault ? 'asignación sin maxInputTokens → 128k' : 'asignación → maxInputTokens declarado'
    return { window, source }
  }
  return { window: DEFAULT_WINDOW, source: 'por defecto: ventana no declarada' }
}
