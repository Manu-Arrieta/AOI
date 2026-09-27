/**
 * scripts/sdd-lifecycle/blueprint-facts.test.mjs
 *
 * Leer los hechos `sbc.*` y darles forma, probado por separado de la compuerta.
 *
 * El caso que más importa es el de la SUCESIÓN, y su importancia está en la
 * dirección del fallo: un `predecessor` que no se puede leer tiene que dejar la
 * obligación EN PIE. El error de más —pedir un diagrama que no hacía falta— es
 * visible y se corrige editando un hecho; el de menos es deuda arquitectónica
 * dispensada en silencio, que es lo que este archivo existe para volver imposible.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { collectBlueprints, parseCrossingValue } from './blueprint-facts.mjs'

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

describe('collectBlueprints — dar forma a los hechos', () => {
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

  it('sin `predecessor`, nadie queda sucedido', () => {
    // El default del campo, y el que hace que este cambio no altere el
    // comportamiento de ningún contrato que no declare su sucesión.
    const [unico] = collectBlueprints([{ key: 'sbc.SBC-2026-001.contexts', value: 'api' }])

    assert.equal(unico.supersededBy, '')
  })

  // ── La sucesión (2026-09-27) ──────────────────────────────────────────────

  it('marca al PREDECESOR como sucedido, leyendo el id de adentro de la prosa', () => {
    // El valor del hecho es texto libre, no un id: así lo escribe `/sdd-genesis`.
    // El `002` real dice "SBC-2026-001 — expandido, no reemplazado: hereda D1...".
    const facts = [
      { key: 'sbc.SBC-2026-001.contexts', value: 'api, billing' },
      { key: 'sbc.SBC-2026-001.crossing.1', value: 'api -> billing: charge' },
      { key: 'sbc.SBC-2026-002.contexts', value: 'api, billing, ledger' },
      {
        key: 'sbc.SBC-2026-002.predecessor',
        value: 'SBC-2026-001 — expandido, no reemplazado: hereda D1 completo y 5 cruces',
      },
    ]

    const [anterior, vigente] = collectBlueprints(facts)

    assert.equal(anterior.sbcId, 'SBC-2026-001')
    assert.equal(anterior.supersededBy, 'SBC-2026-002')
    assert.equal(vigente.supersededBy, '', 'el sucesor NO queda dispensado: es el vigente')
  })

  it('un `predecessor` ilegible no dispensa a NADIE', () => {
    // La dirección del fallo importa: una sucesión que no se puede leer deja la
    // obligación EN PIE. El error de más es un diagrama pedido de más —visible, y
    // se arregla corrigiendo el hecho—; el de menos es deuda en silencio.
    const facts = [
      { key: 'sbc.SBC-2026-001.contexts', value: 'api' },
      { key: 'sbc.SBC-2026-002.predecessor', value: 'el contrato anterior, ese que hicimos antes' },
    ]

    assert.equal(collectBlueprints(facts).find((b) => b.sbcId === 'SBC-2026-001').supersededBy, '')
  })

  it('un `predecessor` que nombra a un SBC SIN hechos no crea un contrato fantasma', () => {
    // Si la marca se aplicara con `entry()`, el predecesor inexistente aparecería
    // como un blueprint con cero contextos y cero cruces —o sea, un contrato vacío
    // en el reporte— en vez de como la referencia rota que es.
    const facts = [
      { key: 'sbc.SBC-2026-002.contexts', value: 'api' },
      { key: 'sbc.SBC-2026-002.predecessor', value: 'SBC-2025-099 fue el anterior' },
    ]

    const blueprints = collectBlueprints(facts)

    assert.equal(blueprints.length, 1)
    assert.equal(blueprints[0].sbcId, 'SBC-2026-002')
  })

  it('un contrato NO puede declararse predecesor de sí mismo', () => {
    // Sin la guarda, escribir una línea dispensaría al contrato de sus propios
    // diagramas: la salida gratis que hace inútil la obligación. Que un contrato
    // sin `supersededBy` siga exigiendo su diagrama lo prueba
    // `blueprint-diagram.test.mjs`; acá se prueba que la guarda no lo marca.
    const facts = [
      { key: 'sbc.SBC-2026-001.contexts', value: 'api, billing' },
      { key: 'sbc.SBC-2026-001.crossing.1', value: 'api -> billing: charge' },
      { key: 'sbc.SBC-2026-001.predecessor', value: 'SBC-2026-001, o sea yo mismo' },
    ]

    assert.equal(collectBlueprints(facts)[0].supersededBy, '')
  })
})
