import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { auditAgentRouting, listAgents, parseRegistry, REGISTRY } from './validate-agent-routing.mjs'

const HEADER =
  '| Agent | `runSubagent` Model Parameter | Fallback (NVIDIA NIM) | Category |\n| :--- | :--- | :--- | :--- |\n'

const row = (a, model = 'Provider Model X', fb = 'vendor/model-x') =>
  `| \`${a}\` | \`${model}\` | \`${fb}\` | Razonamiento |\n`

/** Builds a workspace with a registry and a set of agent files. */
function workspace({ registryRows = '', agents = [] }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-routing-'))
  const reg = path.join(root, REGISTRY)
  fs.mkdirSync(path.dirname(reg), { recursive: true })
  fs.writeFileSync(reg, HEADER + registryRows)
  fs.mkdirSync(path.join(root, '.github/agents'), { recursive: true })
  for (const a of agents) fs.writeFileSync(path.join(root, `.github/agents/${a}.agent.md`), '# agent')
  return root
}

describe('parseRegistry', () => {
  it('reads model, fallback and skill path from a row', () => {
    const rows = parseRegistry(HEADER + row('supervisor', 'Deepseek v4 pro - Provider - Deepseek', 'deepseek-ai/v4'))
    assert.deepEqual(rows.get('supervisor'), {
      model: 'Deepseek v4 pro - Provider - Deepseek',
      fallback: 'deepseek-ai/v4',
      skill: '.github/agents/supervisor.agent.md',
    })
  })

  it('ignores table rows that are not agent registrations', () => {
    // Without the path column the parser leans on the model naming its
    // provider, so a prose table with the same shape is not mistaken for one.
    const rows = parseRegistry(HEADER + '| `some-key` | `a` | `b` | d |\n')
    assert.equal(rows.size, 0)
  })

  it('accepts a fallback written with its own inline code, as some providers are', () => {
    const rows = parseRegistry(HEADER + '| `x` | `M - Provider - Z` | DeepSeek (`deepseek-v4-pro`) | R |\n')
    assert.match(rows.get('x').fallback, /deepseek-v4-pro/)
  })
})

describe('auditAgentRouting', () => {
  it('passes when every agent is fully routable', () => {
    const root = workspace({ registryRows: row('supervisor') + row('backend-developer'), agents: ['supervisor', 'backend-developer'] })
    const r = auditAgentRouting(root)

    assert.equal(r.registered, 2)
    assert.deepEqual(r.unrouted, [])
    assert.deepEqual(r.missingModel, [])
    assert.deepEqual(r.missingFallback, [])
    assert.deepEqual(r.badSkillPath, [])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('catches an agent that exists but was never registered', () => {
    // This is the failure the consolidation had to be protected against: an
    // agent silently dropped from the table cannot be delegated to at all.
    const root = workspace({ registryRows: row('supervisor'), agents: ['supervisor', 'ghost-agent'] })

    assert.deepEqual(auditAgentRouting(root).unrouted, ['ghost-agent'])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('catches a registered agent whose fallback was lost in a merge', () => {
    const root = workspace({
      registryRows: `| \`supervisor\` | \`Provider Model X\` |  | R |\n`,
      agents: ['supervisor'],
    })

    assert.deepEqual(auditAgentRouting(root).missingFallback, ['supervisor'])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('catches a row pointing at a definition file that does not exist', () => {
    const root = workspace({ registryRows: row('supervisor'), agents: [] })
    const r = auditAgentRouting(root)

    assert.equal(r.badSkillPath.length, 1)
    assert.match(r.badSkillPath[0], /supervisor/)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('catches a stale row left behind after an agent was deleted', () => {
    const root = workspace({ registryRows: row('supervisor') + row('retired'), agents: ['supervisor'] })

    assert.deepEqual(auditAgentRouting(root).orphanRows, ['retired'])
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('the shipped registry', () => {
  it('routes every agent this repository actually defines', () => {
    const root = process.cwd()
    const r = auditAgentRouting(root)

    assert.equal(r.registered, listAgents(root).length)
    assert.deepEqual(r.unrouted, [], 'an agent on disk has no routing row')
    assert.deepEqual(r.missingFallback, [], 'an agent lost its fallback provider')
    assert.deepEqual(r.badSkillPath, [], 'a routing row points at a missing file')
  })

  it('ninguna superficie inyectada manda a buscar el campo `skillPath`, que ya no existe', () => {
    // Al borrar la columna derivable quedó viva la instrucción que mandaba a
    // buscarla: el Paso 1 del protocolo de delegación pedía un `skillPath` que
    // no está en el registro ni lo emite el constructor de payloads. Una orden
    // insatisfecible, y en la banda que se inyecta en las seis fases.
    const superficies = ['.github/instructions', '.github/agents', '.github/prompts', '.github/skills', 'scripts/subagent-context']
    const culpables = []

    const recorrer = (dir) => {
      if (!fs.existsSync(dir)) return
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) { recorrer(p); continue }
        if (!/\.(md|mjs)$/.test(e.name)) continue
        if (fs.readFileSync(p, 'utf8').includes('skillPath')) culpables.push(p)
      }
    }
    for (const s of superficies) recorrer(path.join(process.cwd(), s))

    assert.deepEqual(culpables, [], 'quedó prosa o código nombrando un campo que el registro no tiene')
  })
})
