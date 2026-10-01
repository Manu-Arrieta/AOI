/**
 * scripts/sdd-lifecycle/context-window.test.mjs
 *
 * La ventana tiene que salir igual para todo proveedor declarado. Los modelos de los
 * fixtures copian la forma de la configuración real medida el 2026-10-01: unos declaran
 * `maxInputTokens` (glm-5.2 de Zai 128 000, qwen3.7-max y deepseek-flash 1 000 000) y
 * otros no (MiniMax, Kimi). Las claves de los fixtures son sintéticas.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { flatten, readProviders } from '../multi-harness/provider-config.mjs'
import {
  ABSOLUTE_CAP,
  DEFAULT_WINDOW,
  LONG_WINDOW,
  anthropicWindow,
  findDeclared,
  resolveWindow,
  thresholdFor,
} from './context-window.mjs'

const SECRET = 'sk-NO-DEBE-SALIR'

const RAW = [
  {
    name: 'Zai',
    vendor: 'customendpoint',
    apiKey: SECRET,
    models: [{ id: 'glm-5.2', name: 'Glm5.2 - Provider - Zai', url: 'https://x', maxInputTokens: 128000, maxOutputTokens: 16000 }],
  },
  {
    name: 'Alibaba',
    vendor: 'customendpoint',
    apiKey: SECRET,
    models: [{ id: 'qwen3.7-max', name: 'Qwen 3.8 plus - Provider - Alibaba', url: 'https://x', maxInputTokens: 1000000 }],
  },
  {
    name: 'DeepSeek',
    vendor: 'customendpoint',
    apiKey: SECRET,
    models: [{ id: 'deepseek-flash', name: 'Deepseek v4 flash - Provider - Deepseek', url: 'https://x', maxInputTokens: 1000000 }],
  },
  { name: 'MiniMax', vendor: 'customendpoint', apiKey: SECRET, models: [{ id: 'MiniMax-M3', name: 'Minimax M3 - Provider - Minimax', url: 'https://x' }] },
  { name: 'Kimi', vendor: 'customendpoint', apiKey: SECRET, models: [{ id: 'kimi-k3', name: 'Kimi-k 3 - Provider - Kimi', url: 'https://x' }] },
]

function declaredEntries(raw = RAW) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-window-'))
  const file = path.join(dir, 'chatLanguageModels.json')
  fs.writeFileSync(file, JSON.stringify(raw))
  try {
    return { providers: readProviders(file), entries: flatten(readProviders(file)) }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

describe('provider-config conserva maxInputTokens', () => {
  it('lo conserva cuando está declarado y no inventa la clave cuando no', () => {
    const { providers, entries } = declaredEntries()
    assert.equal(findDeclared('glm-5.2', entries).maxInputTokens, 128000)
    assert.equal('maxInputTokens' in providers[3].models[0], false, 'un modelo sin ventana no lleva la clave')
    assert.equal('maxOutputTokens' in providers[0].models[0], false, 'sólo se agregó maxInputTokens a la lista segura')
  })

  it('apiKey sigue sin salir', () => {
    const { providers, entries } = declaredEntries()
    assert.ok(!JSON.stringify(providers).includes(SECRET))
    assert.ok(!JSON.stringify(entries).includes(SECRET))
  })

  it('una apiKey declarada dentro del modelo, al lado de maxInputTokens, tampoco sale', () => {
    // Del modelo ahora se copia un campo más: la lista segura no se abre a lo que venga al lado.
    const raw = [{ name: 'Alfa', vendor: 'customendpoint', models: [{ id: 'g', name: 'G', apiKey: SECRET, maxInputTokens: 128000, headers: { Authorization: SECRET } }] }]
    const { providers, entries } = declaredEntries(raw)
    assert.equal(entries[0].maxInputTokens, 128000)
    assert.equal('apiKey' in providers[0].models[0], false)
    assert.ok(!JSON.stringify(providers).includes(SECRET))
    assert.ok(!JSON.stringify(entries).includes(SECRET))
  })
})

describe('thresholdFor', () => {
  it('es la mitad de la ventana con tope absoluto de 200k', () => {
    assert.equal(thresholdFor(LONG_WINDOW), ABSOLUTE_CAP, 'una ventana de 1M no habilita releer 500k por request')
    assert.equal(thresholdFor(200_000), 100_000)
    assert.equal(thresholdFor(DEFAULT_WINDOW), 64_000)
    assert.equal(thresholdFor(256_000), 128_000)
  })
})

describe('resolveWindow', () => {
  const { entries } = declaredEntries()

  it('modelo Anthropic con [1m] en el transcript → 1M', () => {
    assert.deepEqual(resolveWindow({ model: 'claude-opus-5-5[1m]' }, { entries }), { window: LONG_WINDOW, source: 'transcript: modelo [1m]' })
  })

  it('modelo Anthropic sin sufijo → 200k, salvo que un request ya haya leído más', () => {
    assert.equal(resolveWindow({ model: 'claude-opus-5', maxUsage: 150_000 }).window, 200_000)
    assert.equal(resolveWindow({ model: 'claude-opus-5', maxUsage: 250_000 }).window, LONG_WINDOW)
    assert.equal(anthropicWindow('claude-sonnet-5').source, 'transcript: modelo Anthropic')
  })

  it('modelo del transcript declarado → su maxInputTokens, por id, name o valor de subagente', () => {
    assert.equal(resolveWindow({ model: 'glm-5.2' }, { entries }).window, 128_000)
    assert.equal(resolveWindow({ model: 'Qwen 3.8 plus - Provider - Alibaba' }, { entries }).window, 1_000_000)
    const r = resolveWindow({ model: 'Deepseek v4 flash - Provider - Deepseek (customendpoint)' }, { entries })
    assert.deepEqual(r, { window: 1_000_000, source: 'modelo visto → maxInputTokens declarado' })
  })

  it('sin modelo en el transcript → el asignado por su maxInputTokens', () => {
    const r = resolveWindow({}, { entries, assigned: ['Glm5.2 - Provider - Zai (customendpoint)'] })
    assert.deepEqual(r, { window: 128_000, source: 'asignación → maxInputTokens declarado' })
  })

  it('asignado sin maxInputTokens (MiniMax, Kimi) → 128k, no la ventana de otro', () => {
    const r = resolveWindow({}, { entries, assigned: ['Minimax M3 - Provider - Minimax (customendpoint)'] })
    assert.deepEqual(r, { window: DEFAULT_WINDOW, source: 'asignación sin maxInputTokens → 128k' })
    const mixed = resolveWindow({}, { entries, assigned: ['qwen3.7-max', 'kimi-k3'] })
    assert.equal(mixed.window, DEFAULT_WINDOW, 'entre varios slots manda el menor, y uno sin ventana vale 128k')
  })

  it('modelo del transcript no declarado y nada asignado → 128k', () => {
    assert.deepEqual(resolveWindow({ model: 'llama-no-declarado' }, { entries }), { window: DEFAULT_WINDOW, source: 'por defecto: ventana no declarada' })
    assert.deepEqual(resolveWindow({ model: 'kimi-k3' }, { entries }), { window: DEFAULT_WINDOW, source: 'declarado sin maxInputTokens → 128k' })
    assert.deepEqual(resolveWindow(), { window: DEFAULT_WINDOW, source: 'por defecto: ventana no declarada' })
  })
})
