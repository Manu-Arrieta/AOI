/**
 * scripts/multi-harness/provider-store.test.mjs
 *
 * La lectura de la asignación. Es el lado que faltaba: `/init` escribía `assignment.*`
 * y nadie lo leía. `icm` va inyectado — ni la base real ni el binario.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  DEFAULT_KEY, agentKey, categoryKey, categorySlug, defaultWorkspace, isEmpty, parseAssignment,
  readAssignment, registryAgents, resolveAgent, unavailableReason,
} from './provider-store.mjs'
import { memoryIcm } from '../scaffold/fake-icm.mjs'

const A = 'ModeloA - Provider - Alfa (customendpoint)'
const B = 'ModeloB - Provider - Beta (customendpoint)'
const C = 'ModeloC - Provider - Gama (customendpoint)'

describe('categorySlug', () => {
  it('quita la tilde: con y sin ella serían dos slots que se leen igual', () => {
    assert.equal(categorySlug('Implementación'), 'implementacion')
    assert.equal(categoryKey('Implementación'), categoryKey('Implementacion'))
  })
})

describe('resolveAgent', () => {
  const a = parseAssignment([
    { key: DEFAULT_KEY, value: A },
    { key: categoryKey('Implementación'), value: B },
    { key: agentKey('ux-designer'), value: C },
  ])

  it('el override del agente gana a todo', () => {
    assert.deepEqual(resolveAgent('ux-designer', 'Razonamiento', a), { value: C, source: 'agent' })
  })
  it('sin override, la categoría gana al default', () => {
    assert.deepEqual(resolveAgent('backend-developer', 'Implementación', a), { value: B, source: 'category' })
  })
  it('sin nada más específico, el default', () => {
    assert.deepEqual(resolveAgent('supervisor', 'Razonamiento', a), { value: A, source: 'default' })
  })
  it('sin ningún nivel queda SIN ASIGNAR, no con un valor inventado', () => {
    assert.deepEqual(resolveAgent('supervisor', 'Razonamiento', parseAssignment([])), { value: null, source: null })
  })
  it('un agente con puntos en el nombre no se confunde con el separador', () => {
    const b = parseAssignment([{ key: agentKey('speckit.git.commit'), value: C }])
    assert.equal(resolveAgent('speckit.git.commit', 'Implementación', b).value, C)
  })
})

describe('readAssignment contra la salida de icm', () => {
  it('lee una clave que llena la columna de 32 y queda a UN espacio del valor', () => {
    // Medido con el icm real: `assignment.category.implementacion` tiene 34
    // caracteres y el parser anterior la descartaba — el agente caía al default.
    const icm = memoryIcm({ [DEFAULT_KEY]: A, [categoryKey('Implementación')]: B })
    const { ok, assignment } = readAssignment('WS', icm.exec)
    assert.equal(ok, true)
    assert.equal(resolveAgent('backend-developer', 'Implementación', assignment).value, B)
  })

  it('pide la lectura en solo-lectura y filtrada por prefijo', () => {
    const icm = memoryIcm()
    readAssignment('WS', icm.exec)
    assert.deepEqual(icm.calls[0], ['facts', 'list', 'WS', '-p', 'assignment.', '--read-only'])
  })

  it('"no facts for" es una asignación vacía, no un error', () => {
    const r = readAssignment('WS', memoryIcm().exec)
    assert.equal(r.ok, true)
    assert.equal(isEmpty(r.assignment), true)
  })

  it('icm ausente es ok:false con motivo — no se confunde con "sin asignar"', () => {
    const r = readAssignment('WS', () => {
      throw new Error('spawn icm ENOENT')
    })
    assert.equal(r.ok, false)
    assert.match(r.reason, /ENOENT/)
  })
})

describe('registryAgents y workspace', () => {
  it('lee agente y categoría del registro', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-store-'))
    fs.mkdirSync(path.join(root, '.github/instructions'), { recursive: true })
    fs.writeFileSync(
      path.join(root, '.github/instructions/agent-delegation.instructions.md'),
      '| Agent | Category |\n| :-- | :-- |\n| `supervisor` | Razonamiento |\n| `backend-developer` | Implementación |\n',
    )
    assert.deepEqual(registryAgents(root), [
      { agent: 'supervisor', category: 'Razonamiento' },
      { agent: 'backend-developer', category: 'Implementación' },
    ])
    assert.deepEqual(registryAgents(path.join(root, 'nada')), [])
  })

  it('el workspace es el nombre del directorio, como lo registra setup.sh', () => {
    assert.equal(defaultWorkspace('/x/y/Mi Proyecto'), 'Mi Proyecto')
  })
})

describe('unavailableReason — lo que --resolve chequea antes de entregar el valor', () => {
  const discovered = { entries: [{ provider: 'Alfa', vendor: 'customendpoint', id: 'a', name: 'ModeloA - Provider - Alfa' }] }

  it('un valor configurado pasa', () => {
    assert.equal(unavailableReason(A, discovered), null)
  })
  it('un valor que la máquina ya no tiene se nombra, no se entrega', () => {
    assert.match(unavailableReason(B, discovered), /ya no está entre los modelos configurados/)
  })
  it('sin configuración no hay contra qué comparar: no bloquea en CI', () => {
    assert.equal(unavailableReason(B, { entries: [] }), null)
  })
})
