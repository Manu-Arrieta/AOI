/**
 * scripts/sdd-lifecycle/context-copilot.test.mjs
 *
 * La ruta de Copilot del medidor, con fixtures SINTÉTICOS que copian sólo la forma de
 * los transcripts y logs de depuración medidos el 2026-10-01 (registros
 * `{type, data, id, timestamp, parentId}`; `llm_request` con `attrs.inputTokens`,
 * `attrs.debugName`, `attrs.model`; `models.json` con `max_prompt_tokens`). Ningún
 * contenido real entra acá. También: lectura por bloques con tope, tope de avisos,
 * limpieza del estado y tope de tiempo de `icm`.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'
import { WRAPPER, debugLogFor, emptyDebug, scanDebugLine } from './context-copilot.mjs'
import { MAX_FIRES, icmWithTimeout, loadDeclared, runHook, stateFileName, sweepState, STATE_TTL_MS } from './context-meter.mjs'
import { emptyScan, measure, scanLine } from './context-transcript.mjs'
import { findDeclared, isAnthropicModel, resolveWindow } from './context-window.mjs'
import { readLines } from './jsonl-lines.mjs'

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi context copilot '))
after(() => fs.rmSync(TMP, { recursive: true, force: true }))
let n = 0
const tmpDir = () => fs.mkdtempSync(path.join(TMP, `c${n++}-`))

const rec = (type, data) => JSON.stringify({ type, data, id: `i${n++}`, timestamp: '2026-10-01T00:00:00.000Z', parentId: null })
const userMsg = (content) => rec('user.message', { content, attachments: [] })
const assistantMsg = (content, args = '') =>
  rec('assistant.message', { messageId: 'm', content, reasoningText: 'r'.repeat(50_000), toolRequests: args ? [{ toolCallId: 't', name: 'read_file', arguments: args, type: 'function' }] : [] })
const toolStart = (args) => rec('tool.execution_start', { toolCallId: 't', toolName: 'read_file', arguments: { filePath: args } })
const llm = (inputTokens, { debugName = 'panel/editAgent', model = 'gpt-5.4', status = 'ok' } = {}) =>
  JSON.stringify({ ts: 1, dur: 1, sid: 's', type: 'llm_request', name: `chat:${model}`, spanId: 'x', status, attrs: { model, debugName, inputTokens, cachedTokens: 0, inputMessages: '[]' } })

/** Un workspaceStorage sintético: transcript y, si se pide, log de depuración y models.json. */
function copilotSession({ transcript = [], debug = null, models = null, sid = 'sess-1' } = {}) {
  const root = path.join(tmpDir(), 'ws', 'GitHub.copilot-chat')
  const t = path.join(root, 'transcripts', `${sid}.jsonl`)
  fs.mkdirSync(path.dirname(t), { recursive: true })
  fs.writeFileSync(t, transcript.map((l) => `${l}\n`).join(''))
  const d = path.join(root, 'debug-logs', sid, 'main.jsonl')
  if (debug) {
    fs.mkdirSync(path.dirname(d), { recursive: true })
    fs.writeFileSync(d, debug.map((l) => `${l}\n`).join(''))
    if (models) fs.writeFileSync(path.join(path.dirname(d), 'models.json'), JSON.stringify(models))
  }
  return { t, d, sid }
}

const noDeclared = async () => ({ entries: [], assigned: [] })
const hook = (s, state, declaredLoader = noDeclared) => runHook(JSON.stringify({ session_id: s.sid, transcript_path: s.t, prompt: 'p' }), { stateDir: state, declaredLoader })
const big = 'y'.repeat(1_000_000)

describe('Copilot sin log de depuración', () => {
  it('no se mide ni avisa: su transcript no da ni una cota inferior', async () => {
    const s = copilotSession({ transcript: [userMsg(big), assistantMsg(big, JSON.stringify({ filePath: big })), toolStart(big), userMsg('seguí')] })
    const scan = emptyScan()
    for (const l of fs.readFileSync(s.t, 'utf8').split('\n')) if (l) scanLine(scan, l)
    assert.equal(scan.format, 'copilot')
    assert.deepEqual(measure(scan), { tokens: 0, source: 'sin medida: Copilot sin log de depuración', exact: false })
    assert.equal(await hook(s, tmpDir()), '', '≈1M tokens de envoltorio y duplicados no son contexto medido')
  })
})

describe('Copilot con log de depuración', () => {
  it('debugLogFor ubica main.jsonl al lado del transcript, en POSIX y en Windows', () => {
    assert.equal(debugLogFor('/w/GitHub.copilot-chat/transcripts/abc.jsonl'), path.join('/w', 'GitHub.copilot-chat', 'debug-logs', 'abc', 'main.jsonl'))
    assert.match(debugLogFor('C:\\w\\GitHub.copilot-chat\\transcripts\\abc.jsonl'), /debug-logs.abc.main\.jsonl$/)
    assert.equal(debugLogFor('/home/x/.claude/projects/p/abc.jsonl'), null)
  })

  it('el contexto es el inputTokens del último request de la conversación', () => {
    const d = emptyDebug()
    for (const l of [llm(40_000), llm(90_000, { debugName: 'copilotLanguageModelWrapper', model: 'deepseek-v4-pro' }), llm(500_000, { debugName: 'searchSubagentTool' }), llm(700_000, { status: 'error' }), '{"type":"hook","attrs":{}}', 'no json'])
      scanDebugLine(d, l)
    assert.deepEqual([d.usage, d.maxUsage, d.model], [90_000, 90_000, 'deepseek-v4-pro'], 'subagente, errores y otras líneas no cuentan')
    assert.deepEqual(measure(emptyScan(), 0, d), { tokens: 90_000, source: 'exacto: inputTokens del log de Copilot', exact: true })
  })

  it('lee los campos de la cabeza sin confundirlos con claves escapadas en los mensajes, y si no están ahí parsea la línea', () => {
    const d = emptyDebug()
    scanDebugLine(d, JSON.stringify({ ts: 1, type: 'llm_request', status: 'ok', attrs: { model: 'm"1', debugName: 'panel/editAgent', inputTokens: 5, inputMessages: '{"inputTokens":999,"debugName":"summarizeX"}' } }))
    assert.deepEqual([d.usage, d.model], [5, 'm"1'])
    const late = JSON.stringify({ ts: 1, type: 'llm_request', status: 'ok', attrs: { inputMessages: 'q'.repeat(5000), model: 'tarde', inputTokens: 7 } })
    scanDebugLine(d, late)
    assert.deepEqual([d.usage, d.model], [7, 'tarde'], 'otro orden de claves')
  })

  it('un resumen de la conversación vacía el contexto hasta el próximo request', () => {
    const d = emptyDebug()
    for (const l of [llm(300_000), llm(310_000, { debugName: 'summarizeConversationHistory' })]) scanDebugLine(d, l)
    assert.equal(d.usage, 0)
    scanDebugLine(d, llm(30_000))
    assert.equal(d.usage, 30_000)
    assert.equal(d.maxUsage, 300_000)
  })

  it('summarizeVirtualTools resume la lista de tools, no la conversación: no vacía nada', () => {
    const d = emptyDebug()
    for (const l of [llm(300_000), llm(4_000, { debugName: 'summarizeVirtualTools', model: 'gpt-4o-mini' })]) scanDebugLine(d, l)
    assert.deepEqual([d.usage, d.model], [300_000, 'gpt-5.4'])
  })

  it('avisa con la ventana max_prompt_tokens de models.json, una vez por nivel', async () => {
    const models = [{ id: 'gpt-5.4', capabilities: { limits: { max_prompt_tokens: 272_000 } } }]
    const s = copilotSession({ transcript: [userMsg('a')], debug: [llm(100_000)], models })
    const state = tmpDir()
    assert.equal(await hook(s, state), '', '100k < umbral 136k')
    fs.appendFileSync(s.d, `${llm(140_000)}\n`)
    const out = JSON.parse(await hook(s, state))
    assert.match(out.systemMessage, /≈140k tokens \(exacto: inputTokens del log de Copilot\) ≥ umbral 136k \(ventana 272k, Copilot: max_prompt_tokens del modelo\)/)
    assert.equal(await hook(s, state), '')
  })

  const kimi = { id: 'kimi-k3', name: 'Kimi-k 3 - Provider - Kimi', vendor: 'customendpoint' }
  const copilotKimi = [{ id: 'kimi-k3', capabilities: { limits: { max_prompt_tokens: 917_501 } } }]
  const withKimi = async () => ({ entries: [kimi], assigned: [] })

  it('un customendpoint declarado sin ventana no toma la de un modelo de Copilot con el mismo id', async () => {
    const s = copilotSession({ transcript: [userMsg('a')], debug: [llm(150_000, { debugName: WRAPPER, model: 'kimi-k3' })], models: copilotKimi })
    const out = await hook(s, tmpDir(), withKimi)
    assert.match(JSON.parse(out).systemMessage, /ventana 150k, declarado sin maxInputTokens → 128k; request observado mayor/)
  })

  it('el kimi-k3 que sirve Copilot (sin wrapper) sí usa su models.json', async () => {
    const s = copilotSession({ transcript: [userMsg('a')], debug: [llm(150_000, { model: 'kimi-k3' })], models: copilotKimi })
    assert.equal(await hook(s, tmpDir(), withKimi), '', '150k < umbral 200k de una ventana de 917k')
  })

  it('maxInputTokens declarado manda sobre models.json, pase o no por el wrapper', async () => {
    const loader = async () => ({ entries: [{ ...kimi, maxInputTokens: 200_000 }], assigned: [] })
    for (const debugName of [WRAPPER, 'panel/editAgent']) {
      const s = copilotSession({ transcript: [userMsg('a')], debug: [llm(120_000, { debugName, model: 'kimi-k3' })], models: copilotKimi })
      assert.match(await hook(s, tmpDir(), loader), /umbral 100k \(ventana 200k, modelo visto → maxInputTokens declarado\)/, debugName)
    }
  })

  it('un id sin prefijo de vendor no toma la ventana del modelo de otro proveedor', async () => {
    const loader = async () => ({ entries: [{ id: 'deepseek-ai/deepseek-v4-pro', name: 'D', vendor: 'customendpoint', maxInputTokens: 1_000_000 }], assigned: [] })
    const bare = copilotSession({ transcript: [userMsg('a')], debug: [llm(70_000, { debugName: WRAPPER, model: 'deepseek-v4-pro' })], models: [] })
    assert.match(await hook(bare, tmpDir(), loader), /ventana 128k, por defecto: ventana no declarada/)
    const full = copilotSession({ transcript: [userMsg('a')], debug: [llm(70_000, { debugName: WRAPPER, model: 'deepseek-ai/deepseek-v4-pro' })], models: [] })
    assert.equal(await hook(full, tmpDir(), loader), '', 'con su id completo es el declarado: 1M')
  })
})

describe('ventana', () => {
  it('Bedrock y Vertex son Anthropic; otros no', () => {
    for (const id of ['us.anthropic.claude-opus-4-1-20250805-v1:0', 'anthropic.claude-sonnet-4-5', 'claude-opus-4@20250514', 'claude-opus-4.8'])
      assert.ok(isAnthropicModel(id), id)
    for (const id of ['gpt-5.4', 'deepseek-v4-pro', 'us.meta.llama4', null]) assert.equal(isAnthropicModel(id), false, String(id))
    assert.equal(resolveWindow({ model: 'us.anthropic.claude-opus-4-1-20250805-v1:0' }).window, 200_000)
  })

  it('la ventana nunca es menor que el mayor request observado', () => {
    assert.deepEqual(resolveWindow({ model: 'kimi-k3', maxUsage: 483_658 }), { window: 483_658, source: 'por defecto: ventana no declarada; request observado mayor' })
  })

  it('sólo coincidencia exacta de id o name', () => {
    const e = [{ id: 'a/m1', name: 'M uno', maxInputTokens: 1 }]
    assert.equal(findDeclared('m1', e), null)
    assert.equal(findDeclared('M uno', e).id, 'a/m1')
  })
})

describe('tope de avisos por sesión', () => {
  it('compactaciones repetidas no avisan más de MAX_FIRES veces', async () => {
    const s = copilotSession({ transcript: [userMsg('a')], debug: [llm(1)], models: [{ id: 'gpt-5.4', capabilities: { limits: { max_prompt_tokens: 200_000 } } }] })
    const state = tmpDir()
    let fires = 0
    for (let i = 0; i < 10; i++) {
      fs.appendFileSync(s.d, `${llm(150_000)}\n`)
      if (await hook(s, state)) fires++
      fs.appendFileSync(s.d, `${llm(1, { debugName: 'summarizeConversationHistory' })}\n${llm(10_000)}\n`)
      await hook(s, state)
    }
    assert.equal(fires, MAX_FIRES)
  })
})

describe('readLines', () => {
  const lines = Array.from({ length: 50 }, (_, i) => `{"i":${i},"pad":"${'x'.repeat(i)}"}`)
  const file = path.join(TMP, 'l.jsonl')
  fs.writeFileSync(file, `${lines.join('\n')}\n{"partial":`)

  it('por bloques chicos da las mismas líneas que una lectura entera y deja la línea a medias', () => {
    const got = []
    const r = readLines(file, 0, (l) => got.push(l), { chunk: 7 })
    assert.deepEqual(got, lines)
    assert.equal(r.offset, fs.statSync(file).size - '{"partial":'.length)
    assert.equal(r.skipped, false)
  })

  it('con headBytes da la cabeza y, sólo si se pide, la línea entera', () => {
    const heads = []
    const fulls = []
    readLines(file, 0, (h, full) => {
      heads.push(h)
      if (heads.length === 40) fulls.push(full())
    }, { chunk: 9, headBytes: 10 })
    assert.deepEqual(heads, lines.map((l) => l.slice(0, 10)))
    assert.deepEqual(fulls, [lines[39]])
  })

  it('con más bytes nuevos que el tope lee sólo la cola, desde una línea completa, y lo declara', () => {
    const got = []
    const r = readLines(file, 0, (l) => got.push(l), { chunk: 16, maxRead: 200 })
    assert.equal(r.skipped, true)
    assert.ok(got.length > 0 && got.length < lines.length)
    assert.deepEqual(got, lines.slice(lines.length - got.length), 'ninguna línea cortada')
  })
})

describe('estado y dependencias', () => {
  const age = (f, ms) => fs.utimesSync(f, (Date.now() - ms) / 1000, (Date.now() - ms) / 1000)
  const OLD = STATE_TTL_MS + 60_000

  it('borra sólo sus propios estados sin actividad en 7 días; los JSON ajenos del directorio quedan', () => {
    const dir = tmpDir()
    const own = stateFileName('vieja')
    const files = [own, `${own}.123.tmp`, stateFileName('nueva'), 'old.json', 'otro.json.1.tmp', 'keep.txt']
    for (const f of files) fs.writeFileSync(path.join(dir, f), '{}')
    for (const f of files.filter((f) => f !== stateFileName('nueva'))) age(path.join(dir, f), OLD)
    sweepState(dir)
    assert.deepEqual(fs.readdirSync(dir).sort(), ['context-meter-nueva.json', 'keep.txt', 'old.json', 'otro.json.1.tmp'])
  })

  it('una sesión nueva barre el directorio de estado', async () => {
    const dir = tmpDir()
    fs.writeFileSync(path.join(dir, stateFileName('vieja')), '{}')
    age(path.join(dir, stateFileName('vieja')), OLD)
    await runHook(JSON.stringify({ session_id: 'nueva', prompt: 'p' }), { stateDir: dir, declaredLoader: noDeclared })
    assert.deepEqual(fs.readdirSync(dir), [stateFileName('nueva')])
  })

  it('una estimación por bytes que pasa la ventana se toma como resumen: no avisa y vuelve a contar desde ahí', async () => {
    const t = path.join(tmpDir(), 'otro-harness.jsonl')
    fs.writeFileSync(t, `${JSON.stringify({ content: 'w'.repeat(600_000) })}\n`)
    const state = tmpDir()
    const input = JSON.stringify({ session_id: 'h', transcript_path: t })
    assert.equal(await runHook(input, { stateDir: state, declaredLoader: noDeclared }), '', '≈150k > ventana 128k')
    fs.appendFileSync(t, `${JSON.stringify({ content: 'w'.repeat(260_000) })}\n`)
    assert.match(await runHook(input, { stateDir: state, declaredLoader: noDeclared }), /≈65k tokens \(estimado/)
  })

  it('un icm colgado no demora el prompt: la consulta tiene tope y la asignación queda vacía', async () => {
    const bin = tmpDir()
    fs.writeFileSync(path.join(bin, 'icm'), '#!/bin/sh\nsleep 10\n', { mode: 0o755 })
    const prev = process.env.PATH
    process.env.PATH = `${bin}${path.delimiter}${prev}`
    try {
      const t0 = Date.now()
      assert.throws(() => icmWithTimeout(['facts', 'list'], 300))
      const r = await loadDeclared({ root: TMP, discover: () => ({ entries: [] }) })
      assert.deepEqual(r, { entries: [], assigned: [] })
      assert.ok(Date.now() - t0 < 3000, `${Date.now() - t0} ms`)
    } finally {
      process.env.PATH = prev
    }
  })
})
