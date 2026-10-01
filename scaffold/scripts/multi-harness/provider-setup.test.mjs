/**
 * scripts/multi-harness/provider-setup.test.mjs
 *
 * La única vía de escritura de la asignación: el diálogo del setup y las operaciones de
 * `/aoi-providers`. El diálogo se contesta con un `ask` inyectado, sin terminal.
 */

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import {
  applyWrites, existingKeys, formatTable, interactiveWrites, modelChoices, parseSetupArgs, pickValue, resolvedTable, scopeKey,
} from './provider-setup.mjs'
import { UsageError } from '../sdd-lifecycle/cli-flags.mjs'
import { DEFAULT_KEY, RESOLVED_AT_KEY, agentKey, categoryKey, parseAssignment, readAssignment } from './provider-store.mjs'
import { memoryIcm } from '../scaffold/fake-icm.mjs'

const entry = (provider, name, vendor = 'customendpoint') => ({ provider, vendor, id: name, name })
const CHOICES = modelChoices({
  entries: [entry('Alfa', 'ModeloA - Provider - Alfa'), entry('Beta', 'ModeloB - Provider - Beta'), entry('Local', 'Auto', 'copilot')],
})
const [A, B, AUTO] = CHOICES.map((c) => c.value)
const AGENTS = [
  { agent: 'supervisor', category: 'Razonamiento' },
  { agent: 'ux-designer', category: 'Razonamiento' },
  { agent: 'backend-developer', category: 'Implementación' },
]

/** Un `ask` que contesta en orden y falla si le sobran preguntas. */
const script = (answers) => async (q) => {
  if (answers.length === 0) throw new Error(`pregunta sin respuesta: ${q}`)
  return answers.shift()
}

describe('modelChoices', () => {
  it('el valor lleva el sufijo del transporte sólo si el vendor lo usa', () => {
    assert.equal(A, 'ModeloA - Provider - Alfa (customendpoint)')
    assert.equal(AUTO, 'Auto')
  })
})

describe('pickValue', () => {
  it('acepta #n y el valor exacto', () => {
    assert.equal(pickValue('#2', CHOICES), B)
    assert.equal(pickValue('2', CHOICES), B)
    assert.equal(pickValue(A, CHOICES), A)
  })
  it('rechaza lo que no está configurado: guardarlo es un "model not found" diferido', () => {
    assert.throws(() => pickValue('Inventado', CHOICES), /no está entre los modelos configurados/)
    assert.throws(() => pickValue('#9', CHOICES), /no hay modelo #9/)
  })
})

describe('scopeKey', () => {
  it('traduce los tres alcances', () => {
    assert.equal(scopeKey('all', AGENTS), DEFAULT_KEY)
    assert.equal(scopeKey('category:implementación', AGENTS), categoryKey('Implementación'))
    assert.equal(scopeKey('agent:ux-designer', AGENTS), agentKey('ux-designer'))
  })
  it('un alcance que no existe se rechaza nombrándolo: sería un fact que nadie lee', () => {
    assert.throws(() => scopeKey('agent:nadie', AGENTS), /agente desconocido "nadie"/)
    assert.throws(() => scopeKey('category:Otra', AGENTS), /categoría desconocida/)
    assert.throws(() => scopeKey('todo', AGENTS), /alcance inválido/)
  })
})

describe('interactiveWrites — el diálogo del setup', () => {
  it('uno para todos: una sola escritura', async () => {
    const w = await interactiveWrites(AGENTS, CHOICES, script(['1', 'n', 'n']), () => {})
    assert.deepEqual(w, [{ key: DEFAULT_KEY, value: A }])
  })

  it('todos + categoría + agente, y Enter hereda', async () => {
    const answers = ['1', 's', '', '2', 's', '', '2', '']
    const w = await interactiveWrites(AGENTS, CHOICES, script(answers), () => {})
    assert.deepEqual(w, [
      { key: DEFAULT_KEY, value: A },
      { key: categoryKey('Implementación'), value: B },
      { key: agentKey('ux-designer'), value: B },
    ])
    const table = resolvedTable(AGENTS, parseAssignment(w))
    assert.deepEqual(table.map((r) => [r.agent, r.source]), [
      ['supervisor', 'default'], ['ux-designer', 'agent'], ['backend-developer', 'category'],
    ])
  })

  it('una respuesta inválida se vuelve a preguntar, no se guarda', async () => {
    const said = []
    const w = await interactiveWrites(AGENTS, CHOICES, script(['7', 'basura', '2', 'n', 'n']), (m) => said.push(m))
    assert.deepEqual(w, [{ key: DEFAULT_KEY, value: B }])
    assert.ok(said.some((m) => /no hay modelo #7/.test(m)))
  })

  it('el modelo para todos no es opcional: Enter no lo deja vacío', async () => {
    const w = await interactiveWrites(AGENTS, CHOICES, script(['', '1', 'n', 'n']), () => {})
    assert.equal(w[0].value, A)
  })
})

describe('applyWrites', () => {
  it('escribe, sella resolvedAt, y --reset borra los overrides viejos', () => {
    const icm = memoryIcm({ [DEFAULT_KEY]: A, [agentKey('ux-designer')]: A })
    const existing = existingKeys(readAssignment('WS', icm.exec).assignment)
    applyWrites('WS', [{ key: DEFAULT_KEY, value: B }], { reset: true, existing, exec: icm.exec, now: new Date(0) })
    assert.deepEqual([...icm.facts], [[DEFAULT_KEY, B], [RESOLVED_AT_KEY, '1970-01-01T00:00:00.000Z']])
  })

  it('un valor null es un --unset: el agente vuelve a heredar', () => {
    const icm = memoryIcm({ [DEFAULT_KEY]: A, [agentKey('ux-designer')]: B })
    applyWrites('WS', [{ key: agentKey('ux-designer'), value: null }], { exec: icm.exec })
    assert.equal(icm.facts.has(agentKey('ux-designer')), false)
    assert.equal(icm.facts.get(DEFAULT_KEY), A)
  })
})

describe('formatTable', () => {
  it('dice cuántos quedan sin asignar y qué hacer', () => {
    const out = formatTable(resolvedTable(AGENTS, parseAssignment([])))
    assert.match(out, /3 agente\(s\) sin asignar/)
    assert.match(out, /\/aoi-providers/)
  })
})

describe('parseSetupArgs — los argumentos se validan antes de tocar ICM', () => {
  it('lee los modos que usan /aoi-providers, setup.sh y /init', () => {
    assert.equal(parseSetupArgs(['--show']).mode, '--show')
    assert.equal(parseSetupArgs(['--workspace', 'WS', '--show']).workspace, 'WS')
    assert.equal(parseSetupArgs(['--list-models']).mode, '--list-models')
    const i = parseSetupArgs(['--workspace', 'WS', '--interactive', '--if-empty'])
    assert.deepEqual([i.mode, i.ifEmpty], ['--interactive', true])
    const r = parseSetupArgs(['--reset', '--set', 'all=#2'])
    assert.deepEqual([r.reset, r.sets], [true, ['all=#2']])
    assert.deepEqual(parseSetupArgs(['--set', 'all=#1', '--set', 'agent:ux-designer=#3']).sets, ['all=#1', 'agent:ux-designer=#3'])
    assert.deepEqual(parseSetupArgs(['--unset', 'agent:ux-designer']).unsets, ['agent:ux-designer'])
  })

  it('--reset con el --set mal escrito se rechaza: antes borraba la asignación entera e imprimía ✅', () => {
    assert.throws(() => parseSetupArgs(['--reset', '--sett', 'all=#1']), (e) => e instanceof UsageError && /--sett/.test(e.message))
    assert.throws(() => parseSetupArgs(['--reset']), (e) => e instanceof UsageError && /SIN ASIGNAR/.test(e.message))
    assert.throws(() => parseSetupArgs(['--reset', '--unset', 'all']), /--reset sin --set/)
  })

  it('--show no se come en silencio un --set, ni dos modos conviven', () => {
    assert.throws(() => parseSetupArgs(['--show', '--set', 'all=#1']), /no se combinan/)
    assert.throws(() => parseSetupArgs(['--list-models', '--interactive']), /no se combinan/)
  })

  it('sin modo, con --if-empty suelto o con un --set sin valor, es error de uso', () => {
    assert.throws(() => parseSetupArgs([]), /Uso:/)
    assert.throws(() => parseSetupArgs(['--if-empty']), UsageError)
    assert.throws(() => parseSetupArgs(['--set']), UsageError)
  })

  it('el CLI sale con 2 y no llega a ICM: el rechazo ocurre antes del registro', () => {
    // Un root vacío: si el parseo dejara pasar el typo, el CLI moriría por el
    // registro ausente —también con 2— así que lo que se afirma es el MENSAJE.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-psetup-'))
    const cli = fileURLToPath(new URL('./provider-setup.mjs', import.meta.url))
    const r = spawnSync(process.execPath, [cli, '--root', root, '--reset', '--sett', 'all=#1'], { encoding: 'utf8' })
    fs.rmSync(root, { recursive: true, force: true })
    assert.equal(r.status, 2)
    assert.match(r.stderr, /--sett/)
    assert.match(r.stderr, /Flags válidos:.*--set <valor>/)
  })
})
