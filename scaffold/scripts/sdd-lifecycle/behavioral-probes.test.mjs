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

describe('assembled context equals what the budget reports', () => {
  it('BIC-2026-001:never.1 charges the exact literal payload for every phase', () => {
    // The source-body total is still useful attribution, but headings are part
    // of what the harness receives. Comparing the literal string catches a
    // component that is assembled but not billed, including wrapper prose.
    for (const [key, rel] of SDD_PHASES) {
      const assembled = assemblePhaseContext(ROOT, rel, key)
      const budget = phaseContextCost(ROOT, rel, key)
      const parts = assembled.parts.reduce((n, p) => n + p.tokens, 0)

      assert.equal(assembled.contentTokens, parts, `${key}: source-body accounting drifted`)
      assert.equal(assembled.payloadTokens, estimateTokens(assembled.text), `${key}: payload is not literal text`)
      assert.equal(budget.contentFloor, parts, `${key}: content attribution drifted`)
      assert.equal(budget.payloadFloor, assembled.payloadTokens, `${key}: literal payload is undercounted`)
      assert.equal(budget.framingTokens, assembled.payloadTokens - parts, `${key}: framing delta drifted`)
    }
  })

  it('BIC-2026-001:oracle detects stale accounting after extra framing is injected', () => {
    const [key, rel] = SDD_PHASES.find(([k]) => k === 'Phase_0_Frame')
    const assembled = assemblePhaseContext(ROOT, rel, key)
    const reframed = `${assembled.text}\n\n===== injected-framing =====\n${'x'.repeat(128)}`

    assert.notEqual(
      estimateTokens(reframed),
      assembled.payloadTokens,
      'a metric that ignores newly emitted framing would silently undercount'
    )
  })

  it('BIC-2026-001:never.2 preserves the Frame source selection and order', () => {
    const [key, rel] = SDD_PHASES.find(([k]) => k === 'Phase_0_Frame')
    const sources = assemblePhaseContext(ROOT, rel, key).parts.map((part) => part.source)

    assert.deepEqual(sources, [
      '.github/prompts/sdd-frame.prompt.md',
      '.github/agents/supervisor.agent.md',
      '.github/instructions/agent-delegation.instructions.md',
      '.github/instructions/icm-protocol.instructions.md',
      '.github/instructions/model-selection.instructions.md',
      '.github/instructions/rtk.instructions.md',
      '.github/skills/icm/SKILL.md',
      '.github/skills/rtk/SKILL.md',
      '.github/skills/sdd-entry/SKILL.md',
      '.github/skills/sdd-lifecycle/SKILL.md',
    ], 'a measurement-only change must not select, omit, or reorder Frame context')
  })

  it('BIC-2026-001:never.3 keeps every affected module byte-identical in scaffold', () => {
    const governed = [
      'scripts/sdd-lifecycle/sdd-phases.mjs',
      'scripts/sdd-lifecycle/assemble-phase-context.mjs',
      'scripts/sdd-lifecycle/context-budget.mjs',
      'scripts/sdd-lifecycle/cache-prefix.mjs',
      'scripts/sdd-lifecycle/stress-report.mjs',
      'scripts/sdd-lifecycle/behavioral-probes.test.mjs',
      'scripts/sdd-lifecycle/context-budget.test.mjs',
      'scripts/sdd-lifecycle/cache-prefix.test.mjs',
    ]

    for (const rel of governed) {
      assert.equal(
        fs.readFileSync(path.join(ROOT, rel), 'utf8'),
        fs.readFileSync(path.join(ROOT, 'scaffold', rel), 'utf8'),
        `${rel} drifted from its scaffold mirror`
      )
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
    // Se mira `evidence` y no `expected`, y la distinción es un arreglo de
    // diseño, no una comodidad. `expected` describe la FORMA de una respuesta —y
    // para una sonda de sí o no empieza con `^no\b`, que por definición no puede
    // aparecer en medio de un texto—. Lo que hay que probar acá es otra cosa:
    // que la DOCTRINA que hace correcta esa respuesta siga en el contexto.
    //
    // Confundir las dos era el mismo defecto que ya tenía `expected` con el
    // juez: un campo haciendo dos trabajos que se contradicen. Cuando no se
    // declara `evidence`, el criterio de respuesta es también la evidencia.
    const orphaned = PROBES.filter((p) => !(p.evidence ?? p.expected).test(contextOf(p))).map(
      (p) => `${p.id} (${p.phase}): ${p.evidence ?? p.expected} no aparece en el contexto de la fase`
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
    // Nueve sondas prohíben una respuesta equivocada en vez de exigir una
    // correcta. Nombrar el número acá mantiene el límite visible en vez de
    // dejar que una suite verde implique una cobertura que no tiene.
    //
    // El conteo es un TRIPWIRE deliberado y por eso está hardcodeado: sube
    // cuando alguien agrega una sonda de este tipo, y obliga a reconocer que la
    // cobertura conductual creció en la dirección débil (prohibir) y no en la
    // fuerte (exigir). Pasó de 6 a 9 al sumar las tres de la Fase -2.
    const answerOnly = PROBES.filter((p) => p.forbidden).map((p) => p.id)
    assert.equal(answerOnly.length, 9, 'cambió el conjunto de sondas solo verificables con un modelo')
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
    //
    // Y la segunda hardcodeaba la lista de fases, que es peor: una fase nueva
    // quedaba fuera del bucle Y del inventario, así que podía existir con CERO
    // cobertura conductual sin que nada lo dijera. Se deriva de `SDD_PHASES`
    // —la lista que el presupuesto ya mantiene— para que agregar una fase rompa
    // este test en vez de esquivarlo.
    const phases = new Set(PROBES.map((p) => p.phase))
    for (const [key] of SDD_PHASES) {
      assert.ok(phases.has(key), `ninguna sonda cubre ${key}`)
      assert.ok(coverageFor(key).length > 0, `el inventario no declara ninguna decisión para ${key}`)
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
