/**
 * scripts/multi-harness/provider-assignment.test.mjs
 *
 * Fixtures sintéticas, nunca el árbol real: una aserción sobre "el repo donde estoy
 * corriendo" es un fixture escondido que pasa acá y falla en los otros árboles.
 *
 * Lo que fijan: el registro declara CATEGORÍA, no proveedor (`PROVEEDOR EN DURO`), y lo
 * que el workspace tiene asignado existe en la máquina (`ASIGNACIÓN MUERTA`).
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  auditProviderAssignment,
  blockCategory,
  subagentValue,
  versionDrift,
} from './provider-assignment.mjs'
import { DEFAULT_KEY, agentKey, parseAssignment } from './provider-store.mjs'

/** Una entrada de manifiesto, como la produce `provider-config`. */
const entry = (provider, id, name, vendor = 'customendpoint') => ({ provider, vendor, id, name })

const HEADER = '| Agent | Category |\n| :--- | :--- |\n'
const regRow = (a, cat = 'Razonamiento') => `| \`${a}\` | ${cat} |\n`

const MODEL_BLOCK = '## Model Requirement\n\n> **Categoría**: '
const agentFile = (cat) => `# Agente\n\n${MODEL_BLOCK}${cat} · modelo asignado en el setup\n\n## Next\n\nx\n`

function workspace({ registryRows, agents = {}, config }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-assign-'))
  const dir = path.join(root, '.github/instructions')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'agent-delegation.instructions.md'), HEADER + registryRows)
  const adir = path.join(root, '.github/agents')
  fs.mkdirSync(adir, { recursive: true })
  for (const [name, body] of Object.entries(agents)) fs.writeFileSync(path.join(adir, `${name}.agent.md`), body)
  fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify(config ?? []))
  return root
}

const clean = (root) => fs.rmSync(root, { recursive: true, force: true })

const ALFA = entry('Alfa', 'modelo-a5.2', 'ModeloA - Provider - Alfa')
const withConfig = { path: '/tmp/x.json', entries: [ALFA], sources: 1, considered: [] }
const noConfig = { path: null, entries: [], sources: 0, considered: [{ path: '/a', models: 0, present: false }] }

/** Lecturas de ICM inyectadas: ningún test toca la base real. */
const readOf = (facts) => ({ ok: true, assignment: parseAssignment(facts) })
const NOTHING = readOf([])
const audit = (root, opts = {}) => auditProviderAssignment(root, { read: NOTHING, ...opts })

describe('subagentValue', () => {
  it('anexa el sufijo sólo al vendor que lo usa', () => {
    const v = (vendor, name) => subagentValue({ vendor, name })
    assert.equal(v('customendpoint', 'ModeloA - Provider - Alfa'), 'ModeloA - Provider - Alfa (customendpoint)')
    assert.equal(v('copilot', 'Auto'), 'Auto')
  })
})

describe('blockCategory', () => {
  it('lee la categoría del bloque', () => {
    const b = blockCategory(agentFile('Implementación'))
    assert.equal(b.present, true)
    assert.equal(b.category, 'Implementación')
    assert.equal(b.namesProvider, false)
  })

  it('detecta que el bloque nombra un proveedor', () => {
    const b = blockCategory('# a\n\n## Model Requirement\n\n> **Model**: `ModeloA - Provider - Alfa`\n\n## Next\n')
    assert.equal(b.namesProvider, true, 'la firma `Provider -` tiene que disparar')
  })

  it('reconoce el bloque aunque sea lo último del archivo', () => {
    // Sin `|$` en el lookahead, un bloque sin sección siguiente se reportaba ausente:
    // un veredicto que depende del orden del archivo es frágil.
    const b = blockCategory('# a\n\n## Model Requirement\n\n> **Categoría**: Razonamiento\n')
    assert.equal(b.present, true)
    assert.equal(b.category, 'Razonamiento')
  })

  it('sin bloque lo dice en vez de inventar una categoría', () => {
    assert.deepEqual(blockCategory('# a\n\n## Other\n'), {
      present: false,
      category: null,
      namesProvider: false,
    })
  })
})

describe('versionDrift', () => {
  it('nombra las dos versiones cuando discrepan', () => {
    const d = versionDrift({ id: 'modelo-c3.7-max', name: 'ModeloC 3.8 plus - Provider - Beta' })
    assert.match(d, /3\.7.*3\.8/)
  })

  it('no inventa drift cuando coinciden ni cuando falta el token', () => {
    assert.equal(versionDrift({ id: 'modelo-a5.2', name: 'ModeloA - Provider - Alfa' }), null)
    assert.equal(versionDrift({ id: 'ModeloE-M3', name: 'ModeloE M3 - Provider - Epsilon' }), null)
  })
})

describe('auditProviderAssignment — estáticos', () => {
  it('falla con un registro vacío en vez de dar verde sobre cero entradas', () => {
    const root = workspace({ registryRows: '', agents: {} })
    const r = audit(root, { discovered: withConfig })

    assert.equal(r.agents, 0)
    assert.ok(r.failures.some((f) => /REGISTRO VACÍO/.test(f)))
    clean(root)
  })

  it('nombra al agente que escribe su modelo en duro', () => {
    const root = workspace({
      registryRows: regRow('uno'),
      agents: { uno: '# a\n\n## Model Requirement\n\n> **Model**: `X - Provider - Alfa`\n\n## Next\n' },
    })
    const r = audit(root, { discovered: withConfig })

    assert.ok(r.failures.some((f) => /PROVEEDOR EN DURO/.test(f) && /uno/.test(f)), r.failures.join('\n'))
    clean(root)
  })

  it('falla si el bloque no declara categoría', () => {
    const root = workspace({
      registryRows: regRow('uno'),
      agents: { uno: '# a\n\n## Model Requirement\n\n> algo\n\n## Next\n' },
    })
    const r = audit(root, { discovered: withConfig })
    assert.ok(r.failures.some((f) => /SIN CATEGORÍA/.test(f)))
    clean(root)
  })

  it('falla si el bloque y el registro discrepan', () => {
    const root = workspace({ registryRows: regRow('uno', 'Razonamiento'), agents: { uno: agentFile('Implementación') } })
    const r = audit(root, { discovered: withConfig })

    assert.ok(r.failures.some((f) => /CATEGORÍA DISCREPA/.test(f)), r.failures.join('\n'))
    clean(root)
  })

  it('falla si el registro usa una categoría fuera del vocabulario', () => {
    const root = workspace({ registryRows: regRow('uno', 'Razonamineto'), agents: { uno: agentFile('Razonamineto') } })
    const r = audit(root, { discovered: withConfig })
    assert.ok(r.failures.some((f) => /CATEGORÍA DESCONOCIDA/.test(f) && /Razonamineto/.test(f)))
    clean(root)
  })

  it('falla si un agente del directorio no tiene bloque', () => {
    const root = workspace({ registryRows: regRow('uno'), agents: { uno: '# a\n\n## Otra\n' } })
    const r = audit(root, { discovered: withConfig })
    assert.ok(r.failures.some((f) => /SIN BLOQUE/.test(f)))
    clean(root)
  })
})

describe('auditProviderAssignment — la asignación guardada', () => {
  const ok = () => workspace({ registryRows: regRow('uno'), agents: { uno: agentFile('Razonamiento') } })
  const A = subagentValue(ALFA)

  it('sin nada asignado lo declara OMITIDO, no verde', () => {
    const root = ok()
    const r = audit(root, { discovered: withConfig })
    assert.deepEqual(r.failures, [])
    assert.match(r.omitted.join('\n'), /no hay nada asignado/)
    clean(root)
  })

  it('un valor asignado que la máquina no tiene es ASIGNACIÓN MUERTA', () => {
    // Es el chequeo que faltaba: un id muerto o el placeholder del plan viejo
    // quedaban en verde hasta la primera delegación.
    const root = ok()
    const read = readOf([
      { key: DEFAULT_KEY, value: A },
      { key: agentKey('uno'), value: '<el value de la sonda elegida>' },
    ])
    const r = audit(root, { discovered: withConfig, read })
    assert.equal(r.failures.length, 1)
    assert.match(r.failures[0], /ASIGNACIÓN MUERTA\s+assignment\.agent\.uno/)
    assert.equal(r.stored, 2)
    clean(root)
  })

  it('todos los valores configurados: sin fallas ni omisiones', () => {
    const root = ok()
    const r = audit(root, { discovered: withConfig, read: readOf([{ key: DEFAULT_KEY, value: A }]) })
    assert.deepEqual(r.failures, [])
    assert.deepEqual(r.omitted, [])
    clean(root)
  })

  it('con asignación pero sin configuración, el contraste se OMITE con motivo', () => {
    const root = ok()
    const r = audit(root, { discovered: noConfig, read: readOf([{ key: DEFAULT_KEY, value: A }]) })
    assert.deepEqual(r.failures, [])
    assert.match(r.omitted.join('\n'), /no hay configuración/)
    clean(root)
  })

  it('icm ausente se OMITE nombrando el motivo', () => {
    const root = ok()
    const r = audit(root, { discovered: withConfig, read: { ok: false, assignment: parseAssignment([]), reason: 'icm no respondió' } })
    assert.match(r.omitted.join('\n'), /icm no respondió/)
    clean(root)
  })

  it('los estáticos igual corren sin configuración — así el defecto es visible en CI', () => {
    const root = workspace({ registryRows: regRow('uno'), agents: { uno: agentFile('Implementación') } })
    assert.ok(audit(root, { discovered: noConfig }).failures.some((f) => /CATEGORÍA DISCREPA/.test(f)))
    clean(root)
  })

  it('advierte por el drift de versión del manifiesto, una sola vez', () => {
    const root = ok()
    const discovered = { ...withConfig, entries: [entry('Beta', 'modelo-c3.7-max', 'ModeloC 3.8 plus - Provider - Beta')] }
    assert.equal(audit(root, { discovered }).warnings.filter((w) => /VERSIÓN/.test(w)).length, 1)
    clean(root)
  })
})
