/**
 * scripts/sdd-lifecycle/context-meter.test.mjs
 *
 * Transcripts sintéticos con la forma de los de Claude Code medidos el 2026-10-01
 * (`message.usage`, adjunto `model` con `[1m]`, `compact_boundary`) y de un harness sin
 * `usage`. El estado vive en un directorio temporal; `declaredLoader` es un doble, así
 * que ningún test lee la configuración de VS Code ni consulta `icm`.
 */

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, describe, it } from 'node:test'
import { emptyScan, measure, scanLine, scanTranscript } from './context-transcript.mjs'
import { adviceLine, crossing, runHook, sessionKey } from './context-meter.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi context meter '))
after(() => fs.rmSync(TMP, { recursive: true, force: true }))

let n = 0
const tmpDir = () => fs.mkdtempSync(path.join(TMP, `s${n++}-`))

const assistant = (id, total, model = 'claude-opus-5-5') =>
  JSON.stringify({
    type: 'assistant',
    uuid: `u-${id}`,
    sessionId: 's',
    message: { id, model, content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 2, cache_read_input_tokens: total - 1002, cache_creation_input_tokens: 1000, output_tokens: 9 } },
  })
const user = (text) => JSON.stringify({ type: 'user', uuid: 'u', sessionId: 's', message: { role: 'user', content: text } })
const identity = (modelId) => JSON.stringify({ type: 'attachment', uuid: 'a', sessionId: 's', attachment: { type: 'model', identity: { modelId } } })

function transcript(dir, lines) {
  const file = path.join(dir, 'transcript.jsonl')
  fs.writeFileSync(file, lines.map((l) => `${l}\n`).join(''))
  return file
}

const noDeclared = async () => ({ entries: [], assigned: [] })
const hook = (input, stateDir, declaredLoader = noDeclared) => runHook(JSON.stringify(input), { stateDir, declaredLoader })

describe('context-transcript', () => {
  it('ruta exacta: el contexto es input + cache_read + cache_creation del último request', () => {
    const file = transcript(tmpDir(), [user('hola'), assistant('m1', 40_000), user('seguí'), assistant('m2', 123_456)])
    assert.deepEqual(measure(scanTranscript(file)), { tokens: 123_456, source: 'exacto: usage del transcript', exact: true })
  })

  it('ruta estimada: sin usage son los bytes del contenido / 4, y lo dice', () => {
    const text = 'x'.repeat(4000)
    const file = transcript(tmpDir(), [user(text), JSON.stringify({ role: 'assistant', content: text }), 'línea que no es JSON'])
    const m = measure(scanTranscript(file))
    assert.equal(m.source, 'estimado: bytes del transcript/4')
    const expected = Buffer.byteLength(JSON.stringify(text)) + Buffer.byteLength(JSON.stringify({ role: 'assistant', content: text })) + Buffer.byteLength('línea que no es JSON')
    assert.equal(m.tokens, Math.round(expected / 4))
  })

  it('una compactación vacía el contexto; subagentes y mensajes sintéticos no cuentan', () => {
    const scan = emptyScan()
    for (const l of [assistant('m1', 300_000), JSON.stringify({ type: 'system', subtype: 'compact_boundary', uuid: 'c' })]) scanLine(scan, l)
    assert.equal(scan.usage, null)
    scanLine(scan, JSON.stringify({ isSidechain: true, uuid: 'x', message: { id: 'sub', model: 'claude-opus-5', usage: { input_tokens: 900_000 } } }))
    scanLine(scan, JSON.stringify({ uuid: 'y', message: { id: 'syn', model: '<synthetic>', usage: { input_tokens: 5 } } }))
    assert.equal(scan.usage, null)
    assert.equal(scan.maxUsage, 300_000, 'la evidencia de ventana larga sobrevive a la compactación')
  })

  it('una compactación también vacía los bytes estimados: después cuenta sólo lo nuevo', () => {
    const scan = emptyScan()
    scanLine(scan, user('a'.repeat(40_000)))
    scanLine(scan, JSON.stringify({ type: 'system', subtype: 'compact_boundary', uuid: 'c' }))
    assert.equal(scan.contentBytes, 0)
    scanLine(scan, user('b'.repeat(400)))
    assert.equal(measure(scan).tokens, 100, 'los 40.000 bytes de antes de la compactación no cuentan')
  })

  it('incremental: lee sólo lo agregado y llega al mismo estado que una lectura completa', () => {
    const dir = tmpDir()
    const file = transcript(dir, [identity('claude-opus-5-5[1m]'), user('a'), assistant('m1', 50_000)])
    const first = scanTranscript(file)
    fs.appendFileSync(file, `${user('b'.repeat(100))}\n${assistant('m2', 80_000)}\n{"partial":`)
    const second = scanTranscript(file, first)
    assert.equal(second.offset, fs.statSync(file).size - '{"partial":'.length, 'una línea a medio escribir se deja para el próximo disparo')
    assert.deepEqual(second, scanTranscript(file))
    assert.equal(second.usage, 80_000)
  })

  it('un transcript reescrito más chico se relee desde cero', () => {
    const file = transcript(tmpDir(), [assistant('m1', 90_000), assistant('m2', 95_000)])
    const prev = scanTranscript(file)
    fs.writeFileSync(file, `${assistant('n1', 10_000)}\n`)
    assert.equal(scanTranscript(file, prev).usage, 10_000)
  })
})

describe('crossing', () => {
  it('avisa al cruzar el umbral y después cada +50 %', () => {
    let level = -1
    const fires = []
    for (const t of [99_000, 100_000, 120_000, 149_000, 150_000, 200_000, 225_000, 230_000]) {
      const c = crossing(t, 100_000, level)
      level = c.level
      if (c.fire) fires.push(t)
    }
    assert.deepEqual(fires, [100_000, 150_000, 225_000])
  })

  it('bajar del umbral (compactación) rearma el aviso', () => {
    assert.deepEqual(crossing(50_000, 100_000, 2), { fire: false, level: -1 })
    assert.equal(crossing(100_000, 100_000, -1).fire, true)
  })
})

describe('runHook', () => {
  it('sin id de sesión ni transcript no hace nada y no escribe estado', async () => {
    const state = tmpDir()
    assert.equal(await hook({ prompt: 'x'.repeat(10_000_000) }, state), '')
    assert.deepEqual(fs.readdirSync(state), [])
  })

  it('stdin que no es JSON, o JSON que no es objeto: nada', async () => {
    const state = tmpDir()
    for (const garbage of ['', 'no json', '42', 'null', '[1,2]']) assert.equal(await runHook(garbage, { stateDir: state, declaredLoader: noDeclared }), '')
  })

  it('ruta exacta con [1m]: el tope de 200k manda sobre la mitad de 1M', async () => {
    const dir = tmpDir()
    const state = tmpDir()
    const file = transcript(dir, [identity('claude-opus-5-5[1m]'), user('a'), assistant('m1', 190_000)])
    assert.equal(await hook({ session_id: 'abc', transcript_path: file }, state), '')
    fs.appendFileSync(file, `${user('b')}\n${assistant('m2', 210_000)}\n`)
    const out = JSON.parse(await hook({ session_id: 'abc', transcript_path: file }, state))
    assert.equal(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit')
    assert.equal(out.systemMessage, out.hookSpecificOutput.additionalContext)
    assert.match(out.systemMessage, /≈210k tokens \(exacto: usage del transcript\) ≥ umbral 200k \(ventana 1M, transcript: modelo \[1m\]\)/)
    assert.match(out.systemMessage, /checkpoint en ICM.*contexto nuevo o subagente.*\.tasks\/.*aoi:handoffs/)
    assert.equal(await hook({ session_id: 'abc', transcript_path: file }, state), '', 'una vez por nivel, no en cada prompt')
    fs.appendFileSync(file, `${assistant('m3', 300_000)}\n`)
    assert.notEqual(await hook({ session_id: 'abc', transcript_path: file }, state), '', 'vuelve a avisar al +50 %')
  })

  it('ruta estimada con modelo no declarado → ventana 128k → umbral 64k', async () => {
    const dir = tmpDir()
    const file = transcript(dir, [JSON.stringify({ role: 'user', model: 'kimi-k3', content: 'y'.repeat(260_000) })])
    const out = await hook({ sessionId: 'copilot-1', transcript_path: file }, tmpDir())
    assert.match(JSON.parse(out).systemMessage, /\(estimado: bytes del transcript\/4\) ≥ umbral 64k \(ventana 128k, por defecto: ventana no declarada\)/)
  })

  it('la ventana declarada del modelo asignado sube el umbral, y se resuelve una vez por sesión', async () => {
    let calls = 0
    const loader = async () => {
      calls++
      return { entries: [{ id: 'qwen3.7-max', name: 'Q', vendor: 'customendpoint', maxInputTokens: 1_000_000 }], assigned: ['qwen3.7-max'] }
    }
    const dir = tmpDir()
    const state = tmpDir()
    const file = transcript(dir, [JSON.stringify({ content: 'z'.repeat(400_000) })])
    assert.equal(await hook({ sessionId: 'q', transcript_path: file }, state, loader), '', '100k estimados < umbral 200k')
    fs.appendFileSync(file, `${JSON.stringify({ content: 'z'.repeat(500_000) })}\n`)
    assert.match(await hook({ sessionId: 'q', transcript_path: file }, state, loader), /umbral 200k \(ventana 1M, asignación → maxInputTokens declarado\)/)
    assert.equal(calls, 1)
  })

  it('sin transcript cuenta los prompts observados y lo rotula como cota inferior', async () => {
    const state = tmpDir()
    assert.equal(await hook({ session_id: 'p', prompt: 'a'.repeat(200_000) }, state), '')
    assert.match(await hook({ session_id: 'p', prompt: 'a'.repeat(100_000) }, state), /prompts observados\/4, cota inferior/)
  })

  it('la clave de sesión no escapa del directorio de estado', () => {
    assert.equal(sessionKey({ session_id: 'abc-1.2_x' }), 'abc-1.2_x')
    assert.match(sessionKey({ session_id: '../../etc/passwd' }), /^[0-9a-f]{32}$/)
    assert.match(sessionKey({ transcript_path: '/t.jsonl' }), /^t-[0-9a-f]{32}$/)
    assert.equal(sessionKey({}), null)
  })

  it('la línea de aviso es una sola y corta', () => {
    const line = adviceLine({ tokens: 210_000, source: 'exacto: usage del transcript', threshold: 200_000, window: 1_000_000, windowSource: 'transcript: modelo [1m]' })
    assert.equal(line.includes('\n'), false)
    assert.ok(Buffer.byteLength(line) < 400, `${Buffer.byteLength(line)} B`)
  })
})

describe('context-meter-hook.sh', () => {
  const script = path.join(REPO, '.github/scripts/context-meter-hook.sh')
  const run = (stdin, extraEnv = {}) =>
    spawnSync('/bin/bash', [script], { input: stdin, encoding: 'utf8', cwd: os.tmpdir(), env: { ...process.env, AOI_CONTEXT_METER_DIR: tmpDir(), ...extraEnv } })

  it('basura por stdin, o sin node en el PATH: exit 0 y stdout vacío', () => {
    for (const r of [run('{{{ no json'), run('', { PATH: '/nonexistent' })]) {
      assert.equal(r.status, 0)
      assert.equal(r.stdout, '')
    }
  })

  it('desde un cwd fuera de la raíz, con un transcript sobre el umbral, imprime un único JSON', () => {
    const file = transcript(tmpDir(), [identity('claude-opus-5-5[1m]'), assistant('m1', 420_000)])
    const r = run(JSON.stringify({ session_id: 'sh', transcript_path: file, prompt: 'p' }))
    assert.equal(r.status, 0)
    assert.equal(r.stdout.trim().split('\n').length, 1)
    assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /≈420k tokens/)
  })
})
