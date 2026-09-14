/**
 * scripts/sdd-lifecycle/genesis-phase.test.mjs
 *
 * El módulo que mide la Fase -2, medido.
 *
 * Existe por una razón concreta: `runGenesisPhase` lee un fixture y decide si la
 * fase reporta un ahorro o no. Si el fixture se rompe —alguien le agrega un
 * contexto y olvida su cruce, por ejemplo— la compuerta real habría BLOQUEADO la
 * aprobación del blueprint, y la fase estaría reportando el ahorro de una
 * compuerta que nunca dejó pasar nada. Ese es el falso verde que este test
 * impide, y es el motivo por el que los casos de fallo importan más que el feliz.
 *
 * La salida se captura porque el formato de la línea ES un contrato:
 * `stress-suite.test.mjs` la parsea con `Phase (-?\d+) complete:` para contar
 * fases y fidelidad. Cambiar el formato acá sin cambiar allá dejaría la fase
 * fuera de la contabilidad en silencio.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  BLUEPRINT_FIXTURE,
  BLUEPRINT_PROSE,
  blueprintFactsText,
  runGenesisPhase,
} from './genesis-phase.mjs'
import { createLedger } from './token-accounting.mjs'

/**
 * La clave de la fase, accedida siempre por corchetes.
 *
 * No es estilo: `Phase_-2_Genesis` NO es un identificador válido en JavaScript.
 * El `-` parte la expresión en `Phase_ - 2_Genesis`, y `2_Genesis` se lee como un
 * separador numérico, que es un error de sintaxis. Es la misma trampa que el `-`
 * del regex del stress suite: un número negativo en el nombre de la fase rompe
 * las construcciones que asumen dígitos positivos.
 */
const PHASE_KEY = 'Phase_-2_Genesis'

/** Corre `fn` capturando stdout y stderr. */
function capture(fn) {
  const logs = []
  const errs = []
  const originalLog = console.log
  const originalErr = console.error
  console.log = (...args) => logs.push(args.join(' '))
  console.error = (...args) => errs.push(args.join(' '))
  try {
    return { result: fn(), logs, errs }
  } finally {
    console.log = originalLog
    console.error = originalErr
  }
}

/** Un blueprint al que le falta un cruce: la compuerta tiene que rechazarlo. */
function brokenBlueprint(overrides = {}) {
  return { ...BLUEPRINT_FIXTURE, ...overrides }
}

describe('el fixture está cerrado — la invariante que sostiene la medición', () => {
  it('la fase aprueba con el fixture tal como está en el repo', () => {
    const { result } = capture(() => runGenesisPhase(createLedger()))
    assert.equal(result.ok, true, 'el fixture dejó de estar cerrado')
    assert.equal(result.audit.status, 'PASSED')
  })

  it('el fixture declara cruces: sin ellos no habría nada que medir', () => {
    assert.ok(BLUEPRINT_FIXTURE.crossings.length > 0)
    assert.ok(BLUEPRINT_FIXTURE.contexts.length >= 2)
  })
})

describe('el camino que debe PASAR', () => {
  it('registra la fase bajo la clave que el suite y el presupuesto conocen', () => {
    const ledger = createLedger()
    capture(() => runGenesisPhase(ledger))
    assert.ok(ledger.phases[PHASE_KEY], 'la fase no quedó registrada')
  })

  it('declara el corpus como fixture, no como artefacto real', () => {
    // Un SBC real vive en el WORKSPACE. Reportarlo como `measured` inflaría la
    // fidelidad del ciclo con un archivo que este repositorio no tiene.
    const ledger = createLedger()
    capture(() => runGenesisPhase(ledger))
    assert.equal(ledger.phases[PHASE_KEY].provenance, 'fixture')
  })

  it('nunca reporta un ahorro negativo', () => {
    const ledger = createLedger()
    capture(() => runGenesisPhase(ledger))
    const row = ledger.phases[PHASE_KEY]
    assert.ok(row.optimizedTokens <= row.rawTokens, 'la fase optimizada cuesta más que la base')
    assert.ok(row.savedTokens > 0, 'no midió ningún ahorro')
  })

  it('imprime la línea con el formato exacto que el stress suite parsea', () => {
    const { logs } = capture(() => runGenesisPhase(createLedger()))
    const line = logs.join('\n')
    // Mismo patrón que stress-suite.test.mjs: un solo dígito acá significaría
    // que la Fase -2 desaparece del conteo sin que nada falle.
    const m = line.match(/Phase (-?\d+) complete: (\d+) tokens -> (\d+) tokens \(([\d.]+)% saved\) \[(\w+)\]/)
    assert.ok(m, `la línea no coincide con el patrón que el suite parsea:\n${line}`)
    assert.equal(Number(m[1]), -2, 'la fase se reporta con otro número')
    assert.equal(m[5], 'fixture')
  })
})

describe('los caminos que deben FALLAR', () => {
  it('rechaza un blueprint sin ningún cruce de frontera', () => {
    const { result } = capture(() =>
      runGenesisPhase(createLedger(), brokenBlueprint({ crossings: [] })),
    )
    assert.equal(result.ok, false, 'aceptó un sistema partido sin integración declarada')
  })

  it('rechaza un cruce cuyo extremo no está declarado', () => {
    const { result } = capture(() =>
      runGenesisPhase(
        createLedger(),
        brokenBlueprint({
          crossings: [{ tag: 'SBC-2026-001:crossing.1', parsed: { from: 'gateway', to: 'fantasma', flow: 'x' } }],
        }),
      ),
    )
    assert.equal(result.ok, false)
  })

  it('rechaza un blueprint sin Tracer Bullet', () => {
    const { result } = capture(() =>
      runGenesisPhase(createLedger(), brokenBlueprint({ tracer: '' })),
    )
    assert.equal(result.ok, false)
  })

  it('con el fixture roto registra SKIPPED, no un ahorro inventado', () => {
    // Esta es la razón de ser del módulo. La compuerta habría bloqueado la
    // aprobación, así que reportar un ahorro mediría una compuerta que nunca
    // dejó pasar nada. SKIPPED cuenta en la fidelidad y no suma a los totales.
    const ledger = createLedger()
    const { result } = capture(() =>
      runGenesisPhase(ledger, brokenBlueprint({ tracer: '' })),
    )
    const row = ledger.phases[PHASE_KEY]
    assert.equal(result.ok, false)
    assert.equal(row.provenance, 'skipped')
    assert.equal(row.savedTokens, 0, 'un fixture roto reportó ahorro')
    assert.equal(ledger.totals.savedTokens, 0)
    assert.equal(ledger.totals.rawTokens, 0)
  })

  it('explica el fallo en stderr en vez de fallar en silencio', () => {
    const { errs } = capture(() =>
      runGenesisPhase(createLedger(), brokenBlueprint({ tracer: '' })),
    )
    assert.ok(errs.length > 0, 'falló sin decir por qué')
    assert.match(errs.join('\n'), /no está cerrado/)
  })

  it('la fase sigue apareciendo en la contabilidad aunque falle', () => {
    // Descontarla del ledger rompería la suma de fidelidad del suite: una fase
    // que desaparece de la contabilidad es una fase que nadie sabe que falló.
    const ledger = createLedger()
    capture(() => runGenesisPhase(ledger, brokenBlueprint({ tracer: '' })))
    assert.ok(ledger.phases[PHASE_KEY])
    assert.equal(ledger.phases[PHASE_KEY].rawTokens, 0)
  })
})

describe('blueprintFactsText — los hechos que la compuerta realmente lee', () => {
  it('incluye contextos, invariantes, cruces con flujo y tracer', () => {
    const text = blueprintFactsText()
    assert.match(text, /SBC-2026-001\.contexts\s+gateway, billing, ledger/)
    assert.match(text, /never\.1\s+NUNCA/)
    assert.match(text, /crossing\.1\s+gateway -> billing: charge-request/)
    assert.match(text, /tracer\s+gateway -> billing -> ledger/)
  })

  it('la prosa describe lo mismo que el fixture estructura', () => {
    // Si divergen, la fase mediría el costo de leer un documento que no
    // corresponde al blueprint que la compuerta audita.
    for (const context of BLUEPRINT_FIXTURE.contexts) {
      assert.match(BLUEPRINT_PROSE, new RegExp(context), `la prosa no nombra ${context}`)
    }
    assert.match(BLUEPRINT_PROSE, new RegExp(BLUEPRINT_FIXTURE.tracer.split(' -> ')[0]))
  })

  it('no se rompe con un blueprint vacío', () => {
    assert.doesNotThrow(() => blueprintFactsText({ contexts: [], globals: [], crossings: [], tracer: '' }))
  })
})
