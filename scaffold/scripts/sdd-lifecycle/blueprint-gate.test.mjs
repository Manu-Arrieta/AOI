/**
 * scripts/sdd-lifecycle/blueprint-gate.test.mjs
 *
 * La compuerta de clausura decide si un blueprint está cerrado, y esa decisión
 * bloquea la aprobación del Owner. Los casos que importan son los que DEBEN
 * fallar: una compuerta que sólo se prueba con entrada válida deja pasar
 * exactamente los blueprints sin flujos nombrados, que es lo que existe para
 * atrapar.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  auditBlueprintClosure,
  collectBlueprints,
  diagramObligation,
  formatBlueprintGateReport,
  parseCrossingValue,
} from './blueprint-gate.mjs'

/** Un blueprint cerrado y válido, del que cada test rompe una sola cosa. */
function closedBlueprint(overrides = {}) {
  return {
    sbcId: 'SBC-2026-001',
    contexts: ['api', 'billing', 'ledger'],
    globals: [{ tag: 'SBC-2026-001:never.1', statement: 'NUNCA registrar PII en logs' }],
    crossings: [
      { tag: 'SBC-2026-001:crossing.1', raw: 'api -> billing: charge-request', parsed: { from: 'api', to: 'billing', flow: 'charge-request' } },
    ],
    tracer: 'api -> billing -> ledger',
    ...overrides,
  }
}

const check = (audit, id) => audit.checks.find((c) => c.id === id)

describe('parseCrossingValue', () => {
  it('lee origen, destino y flujo del formato que fija el prompt', () => {
    assert.deepEqual(parseCrossingValue('api -> billing: charge-request'), {
      from: 'api',
      to: 'billing',
      flow: 'charge-request',
    })
  })

  it('tolera espacios irregulares', () => {
    assert.deepEqual(parseCrossingValue('  api->billing:  charge  '), {
      from: 'api',
      to: 'billing',
      flow: 'charge',
    })
  })

  it('devuelve null sin flecha — no es un cruce, es un valor mal escrito', () => {
    assert.equal(parseCrossingValue('api billing'), null)
  })

  it('un cruce sin flujo parsea, con flujo vacío: el gate lo tiene que rechazar', () => {
    assert.deepEqual(parseCrossingValue('api -> billing'), { from: 'api', to: 'billing', flow: '' })
  })
})

describe('collectBlueprints', () => {
  it('agrupa los hechos sbc.* por blueprint, y un workspace puede tener varios', () => {
    const facts = [
      { key: 'sbc.SBC-1.contexts', value: 'api, db' },
      { key: 'sbc.SBC-1.tracer', value: 'api -> db' },
      { key: 'sbc.SBC-2.contexts', value: 'web' },
      { key: 'arch.topology', value: 'modular-monolith' },
    ]
    const blueprints = collectBlueprints(facts)
    assert.equal(blueprints.length, 2)
    assert.deepEqual(blueprints[0].contexts, ['api', 'db'])
    assert.equal(blueprints[0].tracer, 'api -> db')
  })

  it('ignora hechos que no son sbc.*', () => {
    assert.equal(collectBlueprints([{ key: 'arch.topology', value: 'x' }]).length, 0)
  })

  it('no se rompe con hechos mal formados', () => {
    const blueprints = collectBlueprints([{ key: 'sbc.SBC-1.contexts', value: '  api ,, db , ' }])
    assert.deepEqual(blueprints[0].contexts, ['api', 'db'])
  })
})

describe('auditBlueprintClosure — el camino que debe PASAR', () => {
  it('un blueprint cerrado pasa con las cinco aserciones', () => {
    const audit = auditBlueprintClosure(closedBlueprint())
    assert.equal(audit.status, 'PASSED')
    assert.equal(audit.checks.every((c) => c.ok), true)
    assert.equal(audit.checks.length, 5)
  })
})

describe('auditBlueprintClosure — los caminos que deben FALLAR', () => {
  it('rechaza un cruce cuyo extremo no es un contexto declarado', () => {
    const audit = auditBlueprintClosure(
      closedBlueprint({
        crossings: [{ tag: 'SBC-2026-001:crossing.1', raw: 'api -> fantasma: x', parsed: { from: 'api', to: 'fantasma', flow: 'x' } }],
      }),
    )
    assert.equal(audit.status, 'FAILED')
    assert.equal(check(audit, 'closure.endpoints').ok, false)
    assert.match(check(audit, 'closure.endpoints').detail, /fantasma/)
  })

  it('rechaza un cruce sin flujo nombrado', () => {
    const audit = auditBlueprintClosure(
      closedBlueprint({
        crossings: [{ tag: 'SBC-2026-001:crossing.1', raw: 'api -> billing', parsed: { from: 'api', to: 'billing', flow: '' } }],
      }),
    )
    assert.equal(audit.status, 'FAILED')
    assert.equal(check(audit, 'closure.flows').ok, false)
  })

  it('rechaza un cruce que ni siquiera parsea', () => {
    const audit = auditBlueprintClosure(
      closedBlueprint({ crossings: [{ tag: 'SBC-2026-001:crossing.1', raw: 'basura', parsed: null }] }),
    )
    assert.equal(audit.status, 'FAILED')
    assert.equal(check(audit, 'closure.endpoints').ok, false)
    assert.equal(check(audit, 'closure.flows').ok, false)
  })

  it('rechaza un sistema partido sin ninguna integración declarada', () => {
    const audit = auditBlueprintClosure(closedBlueprint({ crossings: [] }))
    assert.equal(audit.status, 'FAILED')
    assert.equal(check(audit, 'closure.integration').ok, false)
  })

  it('no exige cruces cuando hay un solo contexto', () => {
    const audit = auditBlueprintClosure(
      closedBlueprint({ contexts: ['api'], crossings: [] }),
    )
    assert.equal(check(audit, 'closure.integration').ok, true)
  })

  it('rechaza invariantes duplicados literalmente', () => {
    const audit = auditBlueprintClosure(
      closedBlueprint({
        globals: [
          { tag: 'SBC-2026-001:never.1', statement: 'NUNCA registrar PII en logs' },
          { tag: 'SBC-2026-001:never.2', statement: 'nunca registrar PII en logs' },
        ],
      }),
    )
    assert.equal(audit.status, 'FAILED')
    assert.equal(check(audit, 'closure.invariants').ok, false)
    assert.match(check(audit, 'closure.invariants').detail, /duplicados/)
  })

  it('rechaza un par polarizado sobre el mismo sujeto', () => {
    const audit = auditBlueprintClosure(
      closedBlueprint({
        globals: [
          { tag: 'SBC-2026-001:never.1', statement: 'NUNCA archivar con verify FAIL' },
          { tag: 'SBC-2026-001:never.2', statement: 'SIEMPRE archivar con verify FAIL' },
        ],
      }),
    )
    assert.equal(audit.status, 'FAILED')
    assert.match(check(audit, 'closure.invariants').detail, /polarizados/)
  })

  it('rechaza un blueprint sin Tracer Bullet', () => {
    const audit = auditBlueprintClosure(closedBlueprint({ tracer: '' }))
    assert.equal(audit.status, 'FAILED')
    assert.equal(check(audit, 'closure.tracer').ok, false)
  })

  it('acumula varios problemas en vez de cortar en el primero', () => {
    const audit = auditBlueprintClosure(closedBlueprint({ crossings: [], tracer: '' }))
    const failed = audit.checks.filter((c) => !c.ok).map((c) => c.id)
    assert.deepEqual(failed, ['closure.integration', 'closure.tracer'])
  })

  it('no se rompe con un blueprint vacío', () => {
    const audit = auditBlueprintClosure(undefined)
    assert.equal(audit.status, 'FAILED')
  })
})

describe('formatBlueprintGateReport', () => {
  it('dice SKIPPED cuando no hay ningún sbc.* y lo dice sin alarmar', () => {
    assert.match(formatBlueprintGateReport([]), /SKIPPED/)
  })

  it('lista las aserciones fallidas en el reporte', () => {
    const report = formatBlueprintGateReport([auditBlueprintClosure(closedBlueprint({ tracer: '' }))])
    assert.match(report, /FAILED/)
    assert.match(report, /Tracer Bullet/)
  })
})
