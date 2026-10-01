import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  CATEGORIES,
  REGISTRY,
  auditAgentRouting,
  auditCategoryCounts,
  categoryDistribution,
  listAgents,
  parseCategoryTable,
  parseRegistry,
} from './validate-agent-routing.mjs'

const HEADER = '| Agent | Category |\n| :--- | :--- |\n'
const row = (a, cat = 'Razonamiento') => `| \`${a}\` | ${cat} |\n`

/** Builds a workspace with a registry, some agent files and an optional published table. */
function workspace({ registryRows = '', agents = [], readme }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-routing-'))
  const reg = path.join(root, REGISTRY)
  fs.mkdirSync(path.dirname(reg), { recursive: true })
  fs.writeFileSync(reg, HEADER + registryRows)
  fs.mkdirSync(path.join(root, '.github/agents'), { recursive: true })
  for (const a of agents) fs.writeFileSync(path.join(root, `.github/agents/${a}.agent.md`), '# agent')
  if (readme !== undefined) {
    fs.mkdirSync(path.join(root, 'scaffold/.vscode'), { recursive: true })
    fs.writeFileSync(path.join(root, 'scaffold/.vscode/README.md'), readme)
  }
  return root
}

const clean = (root) => fs.rmSync(root, { recursive: true, force: true })

describe('parseRegistry', () => {
  it('reads category and skill path from a row', () => {
    const rows = parseRegistry(HEADER + row('supervisor', 'Implementación'))

    assert.deepEqual(rows.get('supervisor'), {
      category: 'Implementación',
      skill: '.github/agents/supervisor.agent.md',
    })
  })

  it('ya no devuelve model ni fallback: esas columnas no existen', () => {
    // El proveedor se retiró del registro porque la asignación se elige en el setup.
    // Si alguien reintroduce la columna, esta aserción lo nombra.
    const rows = parseRegistry(HEADER + row('supervisor'))
    assert.equal(rows.get('supervisor').model, undefined)
    assert.equal(rows.get('supervisor').fallback, undefined)
  })

  it('acepta una categoría fuera del vocabulario para poder NOMBRARLA', () => {
    // Filtrar acá convertiría un typo en "agente sin fila", y el veredicto nombraría al
    // agente en vez del valor. La validación vive en `auditAgentRouting`.
    const rows = parseRegistry(HEADER + '| `x` | Razonamineto |\n')
    assert.equal(rows.get('x').category, 'Razonamineto')
  })

  it('ignora una fila sin categoría', () => {
    assert.equal(parseRegistry(HEADER + '| `x` |  |\n').size, 0)
  })

  it('ignora una fila cuyo primer campo no es un nombre de agente', () => {
    assert.equal(parseRegistry(HEADER + '| `Algo Con Espacios` | R |\n').size, 0)
  })
})

describe('listAgents', () => {
  it('lista los .agent.md sin extensión y ordenados', () => {
    const root = workspace({ agents: ['zeta', 'alfa'] })
    assert.deepEqual(listAgents(root), ['alfa', 'zeta'])
    clean(root)
  })

  it('sin directorio devuelve vacío, no explota', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-routing-vacio-'))
    assert.deepEqual(listAgents(root), [])
    clean(root)
  })
})

describe('auditAgentRouting', () => {
  it('pasa cuando todo agente tiene fila, categoría y archivo', () => {
    const root = workspace({
      registryRows: row('supervisor') + row('backend-developer', 'Implementación'),
      agents: ['supervisor', 'backend-developer'],
    })
    const r = auditAgentRouting(root)

    assert.equal(r.registered, 2)
    assert.deepEqual(r.unrouted, [])
    assert.deepEqual(r.unknownCategory, [])
    assert.deepEqual(r.badSkillPath, [])
    clean(root)
  })

  it('reporta un agente sin fila', () => {
    const root = workspace({ registryRows: row('supervisor'), agents: ['supervisor', 'ghost-agent'] })
    assert.deepEqual(auditAgentRouting(root).unrouted, ['ghost-agent'])
    clean(root)
  })

  it('reporta una fila sin archivo', () => {
    const root = workspace({ registryRows: row('supervisor') + row('retired'), agents: ['supervisor'] })
    assert.deepEqual(auditAgentRouting(root).orphanRows, ['retired'])
    clean(root)
  })

  it('reporta una categoría fuera del vocabulario nombrando el VALOR', () => {
    const root = workspace({ registryRows: row('supervisor', 'Razonamineto'), agents: ['supervisor'] })
    const r = auditAgentRouting(root)

    assert.equal(r.unknownCategory.length, 1)
    assert.match(r.unknownCategory[0], /Razonamineto/, 'tiene que nombrar el valor, no sólo el agente')
    clean(root)
  })

  it('el vocabulario son dos categorías', () => {
    assert.deepEqual(CATEGORIES, ['Razonamiento', 'Implementación'])
  })
})

describe('categoryDistribution', () => {
  it('cuenta agentes por categoría', () => {
    const root = workspace({
      registryRows: row('a') + row('b') + row('c', 'Implementación'),
      agents: ['a', 'b', 'c'],
    })
    const dist = categoryDistribution(parseRegistry(fs.readFileSync(path.join(root, REGISTRY), 'utf8')))

    assert.equal(dist.get('Razonamiento'), 2)
    assert.equal(dist.get('Implementación'), 1)
    clean(root)
  })
})

describe('parseCategoryTable', () => {
  it('lee las filas numéricas e ignora el encabezado y el separador', () => {
    const text = [
      '| Categoría | Agentes | Uso |',
      '| :--- | ------: | :--- |',
      '| Razonamiento | 18 | análisis |',
      '| Implementación | 9 | código |',
    ].join('\n')

    const t = parseCategoryTable(text)
    assert.equal(t.get('razonamiento'), 18)
    assert.equal(t.get('implementación'), 9)
  })

  it('sin tabla devuelve un mapa vacío', () => {
    assert.equal(parseCategoryTable('hola').size, 0)
  })
})

describe('auditCategoryCounts', () => {
  const registry = (rows) =>
    parseRegistry(HEADER + rows)

  it('pasa cuando la tabla publicada coincide', () => {
    const root = workspace({
      registryRows: row('a') + row('b', 'Implementación'),
      readme: '| Razonamiento | 1 | x |\n| Implementación | 1 | y |',
    })
    assert.deepEqual(auditCategoryCounts(root, registry(row('a') + row('b', 'Implementación'))), [])
    clean(root)
  })

  it('falla cuando un conteo no coincide', () => {
    const root = workspace({ readme: '| Razonamiento | 7 | x |' })
    const problems = auditCategoryCounts(root, registry(row('a')))
    assert.ok(problems.some((p) => /CONTEO/.test(p)), `no lo reportó:\n${problems}`)
    clean(root)
  })

  it('falla cuando falta una categoría en la tabla', () => {
    const root = workspace({ readme: '| Implementación | 1 | y |' })
    const problems = auditCategoryCounts(root, registry(row('a')))
    assert.ok(problems.some((p) => /FALTA CATEGORÍA/.test(p)))
    clean(root)
  })

  it('nombra una tabla ilegible en vez de aprobarla', () => {
    const root = workspace({ readme: '# sin tabla' })
    const problems = auditCategoryCounts(root, registry(row('a')))
    assert.ok(problems.some((p) => /TABLA ILEGIBLE/.test(p)), 'una tabla vacía no puede pasar como verde')
    clean(root)
  })

  it('sin tabla publicada no inventa un fallo', () => {
    const root = workspace({})
    assert.deepEqual(auditCategoryCounts(root, registry(row('a'))), [])
    clean(root)
  })
})
