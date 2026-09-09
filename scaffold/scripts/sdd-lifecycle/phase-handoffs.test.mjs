import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { auditHandoffs, formatHandoffChain, HANDOFFS } from './phase-handoffs.mjs'
import { SDD_PHASES } from './context-budget.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** Builds a throwaway workspace with the given prompt bodies. */
function workspace(prompts) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-handoff-'))
  for (const [rel, body] of Object.entries(prompts)) {
    const full = path.join(root, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, body)
  }
  return root
}

describe('the shipped handoff chain', () => {
  it('closes: every required artifact has an earlier producer', () => {
    const r = auditHandoffs(REPO)
    assert.deepEqual(r.orphanRequires, [], 'una fase exige algo que nadie produce antes')
  })

  it('every declared producer actually says it writes the artifact', () => {
    // Declarar en este archivo que una fase produce algo no lo hace cierto.
    // El prompt tiene que nombrarlo, o la declaración es una ficción cómoda.
    assert.deepEqual(auditHandoffs(REPO).silentProducers, [])
  })

  it('every declared consumer actually says it reads the artifact', () => {
    assert.deepEqual(auditHandoffs(REPO).silentConsumers, [])
  })

  it('covers the same six phases the budget knows', () => {
    // Una fase nueva sin contrato de traspaso pasaría inadvertida.
    assert.deepEqual(
      HANDOFFS.map((h) => h.phase),
      SDD_PHASES.map(([k]) => k),
      'el contrato de traspaso y el presupuesto no cubren las mismas fases'
    )
  })

  it('carries the contract that travels through ICM, not through disk', () => {
    // El BIC es el único handoff que no es un archivo: /sdd-frame lo persiste
    // como facts y el Invariant Gate de /sdd-verify lo lee de ahí. Si esa
    // arista se pierde, la compuerta se queda sin nada que verificar.
    const frame = HANDOFFS.find((h) => h.phase === 'Phase_0_Frame')
    const verify = HANDOFFS.find((h) => h.phase === 'Phase_4_Verify')
    assert.ok(frame.produces.includes('bic-facts'), '/sdd-frame ya no produce el contrato')
    assert.ok(verify.requires.includes('bic-facts'), '/sdd-verify ya no consume el contrato')
  })
})

describe('the audit detects a broken chain', () => {
  it('flags a phase that requires an artifact nobody produces', () => {
    const root = workspace({
      '.github/prompts/a.prompt.md': 'produce nada',
      '.github/prompts/b.prompt.md': 'lee design.md',
    })
    const chain = [
      { phase: 'A', prompt: '.github/prompts/a.prompt.md', produces: [], requires: [] },
      { phase: 'B', prompt: '.github/prompts/b.prompt.md', produces: [], requires: ['design.md'] },
    ]

    assert.equal(auditHandoffs(root, chain).orphanRequires.length, 1)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('flags a producer whose prompt never mentions the artifact', () => {
    // El caso del renombre: el productor pasó a escribir otro nombre y el
    // consumidor sigue pidiendo el viejo. Cada prompt se lee perfecto solo.
    const root = workspace({
      '.github/prompts/a.prompt.md': 'escribe blueprint.md',
      '.github/prompts/b.prompt.md': 'lee design.md',
    })
    const chain = [
      { phase: 'A', prompt: '.github/prompts/a.prompt.md', produces: ['design.md'], requires: [] },
      { phase: 'B', prompt: '.github/prompts/b.prompt.md', produces: [], requires: ['design.md'] },
    ]

    assert.equal(auditHandoffs(root, chain).silentProducers.length, 1)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('flags a consumer whose prompt never mentions what it claims to need', () => {
    const root = workspace({
      '.github/prompts/a.prompt.md': 'escribe design.md',
      '.github/prompts/b.prompt.md': 'no lee nada',
    })
    const chain = [
      { phase: 'A', prompt: '.github/prompts/a.prompt.md', produces: ['design.md'], requires: [] },
      { phase: 'B', prompt: '.github/prompts/b.prompt.md', produces: [], requires: ['design.md'] },
    ]

    assert.equal(auditHandoffs(root, chain).silentConsumers.length, 1)
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('the chain renders for the benchmark', () => {
  it('shows inputs and outputs of every phase', () => {
    const out = formatHandoffChain()
    assert.match(out, /Phase_2_FF.*proposal\.md.*spec\.md/s)
    assert.equal(out.split('\n').length, HANDOFFS.length)
  })
})
