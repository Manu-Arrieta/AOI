import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { PROBES, buildProbePrompt } from './behavioral-probes.mjs'
import { COVERAGE, coverageFor } from './behavioral-coverage.mjs'
import { assemblePhaseContext } from './assemble-phase-context.mjs'
import { SDD_PHASES, phaseContextCost } from './context-budget.mjs'
import { estimateTokens } from './token-accounting.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('assembled context equals what the budget charges', () => {
  it('the sum of assembled parts is exactly each phase floor', () => {
    // The cross-check that validates both instruments at once. A component
    // measured but never assembled, or assembled but never measured, looks
    // identical from the outside until these two numbers disagree.
    for (const [key, rel] of SDD_PHASES) {
      const parts = assemblePhaseContext(ROOT, rel, key).parts.reduce((n, p) => n + p.tokens, 0)
      assert.equal(parts, phaseContextCost(ROOT, rel, key).floor, `${key}: assembler and budget disagree`)
    }
  })

  it('excludes conditional branches, which are not part of every run', () => {
    const [key, rel] = SDD_PHASES.find(([k]) => k === 'Phase_2_FF')
    const { text } = assemblePhaseContext(ROOT, rel, key)
    // /speckit.checklist only fires when the contract is non-trivial, so its
    // definition must not appear in the floor context.
    assert.doesNotMatch(text, /===== \.github\/agents\/speckit\.checklist\.agent\.md =====/)
  })
})

describe('every probe has its evidence inside the context it is asked over', () => {
  // The gap this closes. Until now `expected` was only asserted to BE a
  // RegExp — nothing ever ran it. So `pnpm test` passing said the probes were
  // well formed, never that the phase still carries what it takes to answer
  // them, and the 25/25 of the previous cycle was a manual read, not a gate.
  //
  // Running the probes through a model would answer the stronger question and
  // cost inference tokens on every run. This answers the NECESSARY half for
  // free: if the pattern an answer must contain is nowhere in the assembled
  // context, no agent can produce it except from prior knowledge, and a trim
  // that deleted the evidence would sail through. That is exactly the
  // regression this repository keeps producing.
  //
  // What it does NOT prove: that a model actually uses the evidence. Evidence
  // present is necessary, not sufficient, and `forbidden` stays out of reach
  // because it describes an ANSWER — `/triage-specialist/i` is forbidden in a
  // reply while appearing legitimately in the context that reply is drawn from.
  const contextOf = (() => {
    const cache = new Map()
    return (probe) => {
      const key = `${probe.phase}::${probe.prompt}`
      if (!cache.has(key)) cache.set(key, assemblePhaseContext(ROOT, probe.prompt, probe.phase).text)
      return cache.get(key)
    }
  })()

  it('carries, for all 25, the pattern the answer must contain', () => {
    const orphaned = PROBES.filter((p) => !p.expected.test(contextOf(p))).map(
      (p) => `${p.id} (${p.phase}): ${p.expected} no aparece en el contexto de la fase`
    )
    assert.deepEqual(orphaned, [])
  })

  it('fails when the evidence is removed', () => {
    // Negative control. A check that only ever passes proves nothing, and the
    // first negative control written in this repository did not control at all.
    const probe = PROBES.find((p) => p.id === 'srp-limit')
    const stripped = contextOf(probe).replaceAll('300', 'NNN')

    assert.ok(probe.expected.test(contextOf(probe)), 'la evidencia debería estar presente')
    assert.equal(probe.expected.test(stripped), false, 'el chequeo no detecta la evidencia borrada')
  })

  it('declares which probes remain answer-shaped and therefore un-gated', () => {
    // Six probes forbid a wrong answer rather than requiring a right one.
    // Naming them here keeps the limit visible instead of letting a green
    // suite imply coverage it does not have.
    const answerOnly = PROBES.filter((p) => p.forbidden).map((p) => p.id)
    assert.equal(answerOnly.length, 6, 'cambió el conjunto de sondas solo verificables con un modelo')
  })
})

describe('behavioral probes are well formed', () => {
  it('every probe names a phase the budget knows and a prompt that exists', () => {
    const known = new Set(SDD_PHASES.map(([k]) => k))
    for (const p of PROBES) {
      assert.ok(known.has(p.phase), `${p.id}: unknown phase ${p.phase}`)
      assert.ok(fs.existsSync(path.join(ROOT, p.prompt)), `${p.id}: missing prompt ${p.prompt}`)
    }
  })

  it('every probe declares which removal it defends against', () => {
    // A probe with no cut behind it is a test looking for a purpose. Each one
    // exists because a specific piece of prose was taken out.
    for (const p of PROBES) {
      assert.ok(p.cut && p.cut.length > 20, `${p.id}: does not say which cut it defends`)
      assert.ok(p.expected instanceof RegExp, `${p.id}: has no machine-checkable expectation`)
    }
  })

  it('builds a prompt that carries the real phase context and the question', () => {
    const probe = PROBES[0]
    const prompt = buildProbePrompt(ROOT, probe)

    assert.match(prompt, /INICIO DEL CONTEXTO DE LA FASE/)
    assert.match(prompt, /PREGUNTA:/)
    // Big enough to be the actual phase context, not a stub.
    assert.ok(estimateTokens(prompt) > 5000, 'the probe prompt is not carrying a real phase context')
  })

  it('tells the agent to admit when the context is insufficient', () => {
    // Without this the probe measures the model's prior knowledge of AOI
    // instead of what the trimmed context actually supports.
    assert.match(buildProbePrompt(ROOT, PROBES[0]), /NO PUEDO DETERMINARLO CON ESTE CONTEXTO/)
  })

  it('has a probe for every decision the inventory declares', () => {
    // El inventario se deriva de lo que cada fase DECLARA — sus compuertas,
    // sus pasos obligatorios, sus delegaciones. Agregar una compuerta a un
    // prompt sin agregar su sonda es una falla de test, no un descuido que
    // aparece meses despues.
    const ids = new Set(PROBES.map((p) => p.id))
    const sin = COVERAGE.filter((c) => !ids.has(c.decision))
    assert.deepEqual(sin.map((c) => `${c.phase}/${c.decision}`), [], 'decisión declarada sin sonda que la verifique')
  })

  it('probes every phase of the lifecycle, not only the ones that were edited', () => {
    // La primera version solo defendia los cortes de una rama, que es el mismo
    // error que auditar un diff: solo encuentra lo que alguien ya toco.
    const phases = new Set(PROBES.map((p) => p.phase))
    for (const expected of ['Phase_0_Frame', 'Phase_1_New', 'Phase_2_FF', 'Phase_3_Apply', 'Phase_4_Verify', 'Phase_5_Archive']) {
      assert.ok(phases.has(expected), `ninguna sonda cubre ${expected}`)
      assert.ok(coverageFor(expected).length > 0, `el inventario no declara ninguna decisión para ${expected}`)
    }
  })

  it('covers every cut this branch made', () => {
    const cuts = PROBES.map((p) => p.cut.toLowerCase()).join(' ')
    for (const [name, needle] of [
      ['tabla de triaje', 'triaje'],
      ['guía de entrada', 'entrada'],
      ['defaults por categoría', 'categoría'],
      ['regla de service discovery', 'supervisor'],
      ['facts en la skill de ICM', 'facts'],
    ]) {
      assert.ok(cuts.includes(needle), `no probe defends the cut: ${name}`)
    }
  })
})
