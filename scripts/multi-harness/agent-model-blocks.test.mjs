/**
 * scripts/multi-harness/agent-model-blocks.test.mjs
 *
 * The \`## Model Requirement\` block is paid on every delegation, and the
 * supervisor pays it in all six phases, so what it may and may not contain is
 * a token-economy decision as much as a correctness one.
 *
 * Split out of lifecycle-wiring.test.mjs when that file crossed the 300 LOC of
 * Invariant 5.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { estimateTokens } from '../sdd-lifecycle/token-accounting.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

function auditSelectionProtocol(text) {
  const failures = []
  // `ChatLanguageModel.example.json` salió de esta lista junto con el template: se
  // eliminó porque sus referencias de secreto son de la máquina que lo generó y 4 de 6
  // no resolvían. La configuración ahora se detecta, y el protocolo nombra el script
  // que la detecta.
  //
  // `Primary`/`Fallback` salieron también: el setup guarda UN modelo por slot, y una regla
  // que manda a caer a un fallback que no existe es la que decía "usá el picker" mientras
  // otra decía "pará". Lo que se exige ahora es cómo se lee y qué hacer sin modelo.
  for (const needle of ['Missing Model Gate', '--resolve', '/aoi-providers', 'agent-delegation.instructions.md', 'provider-vscode-setup.{sh,ps1}', 'rtk.instructions.md']) {
    if (!text.includes(needle)) failures.push(`missing ${needle}`)
  }
  if (/\bFallback\b/.test(text)) failures.push('names a Fallback that the assignment no longer has')
  if (/\b60[–-]90% token reduction\b/.test(text)) failures.push('stale token-reduction percentage')
  return failures
}

describe('per-agent model blocks stay compressed', () => {
  const agents = fs
    .readdirSync(path.join(ROOT, '.github/agents'))
    .filter((f) => f.endsWith('.agent.md'))

  it('every agent states its CATEGORY and never a provider', () => {
    // La categoría es el único hecho de asignación que vive por agente, y es estático.
    // El proveedor no: se elige en el setup y nombrarlo acá lo deja obsoleto en
    // silencio — hay tres casos medidos, incluido un id que dejó de existir.
    for (const f of agents) {
      const text = read(`.github/agents/${f}`)
      assert.match(text, /## Model Requirement/, `${f} lost its model block`)
      assert.match(text, /\*\*Categor[íi]a\*\*:/, `${f} no longer states its category`)
      assert.doesNotMatch(text, /Provider - /, `${f} names a provider: la asignación es dinámica`)
    }
  })

  it('tells the delegator HOW to read the model, once, in the registry every phase loads', () => {
    // La versión anterior persistía `assignment.*` y el registro seguía mandando a leer
    // el modelo de una columna que ya no existía: nadie leía lo guardado. Lo que se fija
    // es el comando de lectura, no una mención de dónde se decide.
    const registry = read('.github/instructions/agent-delegation.instructions.md')
    assert.match(registry, /provider-store\.mjs --resolve/, 'el registro no dice cómo se lee el modelo')
    assert.match(registry, /\/aoi-providers/, 'el registro no dice cómo se cambia la asignación')
    assert.doesNotMatch(registry, /model from Registry/, 'el registro volvió a mandar a una columna que no existe')

    const stragglers = agents.filter((f) => /picker de Copilot/.test(read(`.github/agents/${f}`)))
    assert.deepEqual(stragglers, [], 'el aviso volvió a duplicarse en los agentes')
  })

  it('does not grow the justification prose back, which lives in the registry', () => {
    // 27 agents × a paragraph of rationale is paid on every delegation and
    // says nothing the operator acts on at that moment.
    const bloated = agents.filter((f) => /Justificación/.test(read(`.github/agents/${f}`)))
    assert.deepEqual(bloated, [], 'model rationale prose came back into the agent files')
  })

  it('keeps the whole block small, since it is paid on every delegation', () => {
    for (const f of agents) {
      const block = /## Model Requirement\n[\s\S]*?(?=\n## )/.exec(read(`.github/agents/${f}`))
      if (!block) continue
      const tokens = estimateTokens(block[0])
      assert.ok(tokens <= 110, `${f} model block grew to ${tokens} tokens`)
    }
  })
})

describe('model-selection instruction stays operationally focused', () => {
  const protocol = read('.github/instructions/model-selection.instructions.md')

  it('keeps the stop rule, the read path, the change path, setup and RTK references', () => {
    assert.deepEqual(auditSelectionProtocol(protocol), [])
  })

  it('detects a removed stop rule', () => {
    assert.deepEqual(auditSelectionProtocol(protocol.replaceAll('Missing Model Gate', 'x')), ['missing Missing Model Gate'])
  })

  it('detects a Fallback coming back', () => {
    assert.deepEqual(auditSelectionProtocol(`${protocol}\nSi no está, el Fallback.`), [
      'names a Fallback that the assignment no longer has',
    ])
  })

  it('detects the retired universal token percentage', () => {
    assert.deepEqual(
      auditSelectionProtocol(`${protocol}\nRTK saves 60–90% token reduction.`),
      ['stale token-reduction percentage']
    )
  })
})
