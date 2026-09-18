/**
 * scripts/sdd-lifecycle/blueprint-diagram.test.mjs
 *
 * La obligación de diagrama y su auditoría, probadas.
 *
 * El caso que importa más que ningún otro es `unmet`. La tentación de hacer la
 * compuerta fail-closed es fuerte, y está mal por una razón que se puede
 * escribir en un test: quien dispara la obligación son los cruces que el humano
 * declaró, así que un bloqueo duro deja una salida gratis — borrar el cruce — y
 * borrar el cruce es el daño que la Fase -2 existe para impedir.
 *
 * Por eso `unmet` NO enforcea y `required` SÍ, y por eso los tres estados no
 * pueden colapsar en un booleano: `not-required` dice "no aplica" y `unmet` dice
 * "falta". Un reporte que imprima lo mismo en los dos casos convierte deuda
 * arquitectónica en silencio.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  BLUEPRINT_DIR,
  auditDiagramArtifacts,
  diagramObligation,
  formatDiagramObligation,
  implicitWorkspace,
  parseGateArgs,
  recordObligation,
} from './blueprint-diagram.mjs'

const withCrossings = (n = 1) => ({
  sbcId: 'SBC-2026-001',
  crossings: Array.from({ length: n }, (_, i) => ({
    tag: `SBC-2026-001:crossing.${i + 1}`,
    parsed: { from: 'a', to: 'b', flow: `flow-${i}` },
  })),
})

describe('diagramObligation — tres estados, no un booleano', () => {
  it('sin cruces la obligación NO EXISTE', () => {
    const o = diagramObligation({ crossings: [] })
    assert.equal(o.status, 'not-required')
    assert.equal(o.enforce, false)
    assert.equal(o.crossings, 0)
  })

  it('con cruces y Archify disponible, la obligación se EXIGE', () => {
    const o = diagramObligation(withCrossings(), { archifyAvailable: true })
    assert.equal(o.status, 'required')
    assert.equal(o.enforce, true)
    assert.match(o.reason, /1 cruce/)
  })

  it('con cruces y sin Archify, la obligación queda INCUMPLIDA y no bloquea', () => {
    // El corazón del diseño. Bloquear acá deja una salida gratis —borrar el
    // cruce— que invierte el propósito de la fase entera.
    const o = diagramObligation(withCrossings(), { archifyAvailable: false })
    assert.equal(o.status, 'unmet')
    assert.equal(o.enforce, false, 'unmet bloqueó: la salida barata sería borrar el cruce')
    assert.match(o.reason, /REGISTRADA, no cumplida/)
  })

  it('not-required y unmet NO son el mismo estado', () => {
    // Si colapsaran, "no aplica" y "falta" se leerían igual, y la deuda
    // desaparecería del reporte sin que nadie la saldara.
    const none = diagramObligation({ crossings: [] })
    const owed = diagramObligation(withCrossings(), { archifyAvailable: false })
    assert.notEqual(none.status, owed.status)
  })

  it('cuenta los cruces, porque el conteo ES el disparador', () => {
    assert.equal(diagramObligation(withCrossings(4)).crossings, 4)
    assert.match(diagramObligation(withCrossings(4)).reason, /4 cruce/)
  })

  it('asume Archify disponible cuando no se le dice, y es explícito en el estado', () => {
    // El default no puede ser "unmet" silencioso: un llamador que no preguntó
    // por la herramienta no debería recibir una obligación incumplida.
    assert.equal(diagramObligation(withCrossings()).status, 'required')
  })

  it('no se rompe con entrada ausente', () => {
    assert.equal(diagramObligation(undefined).status, 'not-required')
    assert.equal(diagramObligation(null).status, 'not-required')
  })

  it('nombra el blueprint en el reporte aunque falte el id', () => {
    assert.equal(diagramObligation({ crossings: [] }, {}).status, 'not-required')
    const o = diagramObligation({ crossings: [{ parsed: {} }] })
    assert.equal(o.status, 'required')
  })
})

describe('auditDiagramArtifacts — sin workspace no hay cumplimiento que afirmar', () => {
  /**
   * Workspace descartable que se limpia SOLO.
   *
   * Registra el borrado con `t.after`, no al final del test. La diferencia no es
   * cosmética: un `rmSync` en la última línea no corre si un assert falla antes,
   * y un test que falla es justo cuando más se acumula basura. Medido antes de
   * este cambio: **15 directorios por corrida**, uno por cada test de este
   * bloque, que quedaban en `$TMPDIR` para siempre.
   */
  const workspace = (t, files) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-dias-'))
    t.after(() => fs.rmSync(root, { recursive: true, force: true }))
    for (const rel of files) {
      const full = path.join(root, rel)
      fs.mkdirSync(path.dirname(full), { recursive: true })
      fs.writeFileSync(full, 'x')
    }
    return root
  }

  it('encuentra los diagramas en la ruta que fija el prompt', (t) => {
    const root = workspace(t, [`${BLUEPRINT_DIR}/SBC-1/diagrams/flow.sequence.html`])
    const audit = auditDiagramArtifacts(root, 'SBC-1')
    assert.equal(audit.present, true)
    assert.deepEqual(audit.files, ['flow.sequence.html'])
  })

  it('un IR sin render cuenta como trabajo hecho', (t) => {
    // Reportar "cero diagramas" sobre un JSON-IR presente sería falso: el
    // trabajo está, sólo falta el render.
    const root = workspace(t, [`${BLUEPRINT_DIR}/SBC-1/diagrams/flow.sequence.json`])
    assert.equal(auditDiagramArtifacts(root, 'SBC-1').present, true)
  })

  it('directorio vacío no es cumplimiento', (t) => {
    const root = workspace(t, [`${BLUEPRINT_DIR}/SBC-1/diagrams/.keep`])
    // `.keep` no es html ni json: el directorio existe pero no hay artefacto.
    assert.equal(auditDiagramArtifacts(root, 'SBC-1').present, false)
  })

  it('ignora archivos que no son diagramas', (t) => {
    const root = workspace(t, [
      `${BLUEPRINT_DIR}/SBC-1/diagrams/notas.md`,
      `${BLUEPRINT_DIR}/SBC-1/diagrams/flow.html`,
    ])
    assert.deepEqual(auditDiagramArtifacts(root, 'SBC-1').files, ['flow.html'])
  })

  it('no confunde el blueprint de otro con el propio', (t) => {
    const root = workspace(t, [`${BLUEPRINT_DIR}/SBC-2/diagrams/otro.html`])
    assert.equal(auditDiagramArtifacts(root, 'SBC-1').present, false)
    assert.equal(auditDiagramArtifacts(root, 'SBC-2').present, true)
  })

  it('sin workspace no afirma nada en vez de afirmar cumplimiento', () => {
    const audit = auditDiagramArtifacts('', 'SBC-1')
    assert.equal(audit.present, false)
    assert.deepEqual(audit.files, [])
  })

  it('un workspace inexistente se reporta como ausente, no revienta', () => {
    assert.doesNotThrow(() => auditDiagramArtifacts('/tmp/no-existe-en-absoluto', 'SBC-1'))
    assert.equal(auditDiagramArtifacts('/tmp/no-existe-en-absoluto', 'SBC-1').present, false)
  })
})

describe('formatDiagramObligation', () => {
  it('distingue visualmente los tres estados', () => {
    const none = formatDiagramObligation('SBC-1', diagramObligation({ crossings: [] }))
    const req = formatDiagramObligation('SBC-1', diagramObligation(withCrossings()))
    const unmet = formatDiagramObligation(
      'SBC-1',
      diagramObligation(withCrossings(), { archifyAvailable: false }),
    )
    assert.match(none, /NOT-REQUIRED/)
    assert.match(req, /REQUIRED/)
    assert.match(unmet, /UNMET/)
  })

  it('cuando falta Archify explica que la obligación arquitectónica NO se relaja', () => {
    // Sin esta línea, `unmet` se lee como "esta fase no exige nada", que es lo
    // contrario de lo que pasa: los cruces siguen exigiendo su flujo nombrado.
    const text = formatDiagramObligation(
      'SBC-1',
      diagramObligation(withCrossings(), { archifyAvailable: false }),
    )
    assert.match(text, /NO se relaja/)
    assert.match(text, /install-archify/)
  })

  it('reporta los artefactos cuando se le pasan', () => {
    const text = formatDiagramObligation('SBC-1', diagramObligation(withCrossings()), {
      present: true,
      dir: '/w/.blueprints/SBC-1/diagrams',
      files: ['a.html'],
    })
    assert.match(text, /1 en/)
    assert.match(text, /a\.html/)
  })

  it('dice NINGUNO cuando el directorio está vacío', () => {
    const text = formatDiagramObligation('SBC-1', diagramObligation(withCrossings()), {
      present: false,
      dir: '/w/.blueprints/SBC-1/diagrams',
      files: [],
    })
    assert.match(text, /NINGUNO/)
  })
})

describe('recordObligation — la deuda tiene que quedar registrada', () => {
  it('sin db usa el store por defecto y reporta el resultado', () => {
    // No se puede afirmar que ICM responda en cualquier entorno, así que el
    // contrato es: SIEMPRE devuelve una línea, y nombra la clave. Un registro
    // que falla en silencio es una deuda invisible.
    const line = recordObligation('AOI-TEST-SINTOPE', 'SBC-X', { status: 'unmet' }, '/ruta/inexistente/x.db')
    assert.match(line, /sbc\.SBC-X\.diagram-obligation/)
    assert.match(line, /↳/)
  })

  it('la clave que registra es la que /sdd-verify va a leer', () => {
    // El handoff es por convención de nombre: si cambia acá y no allá, la deuda
    // desaparece del verify sin que nada falle.
    const line = recordObligation('AOI-TEST', 'SBC-2026-001', { status: 'required' }, '/nada.db')
    assert.match(line, /sbc\.SBC-2026-001\.diagram-obligation/)
  })

  it('nunca tira: un ICM caído no puede abortar la compuerta', () => {
    assert.doesNotThrow(() => recordObligation('AOI', 'SBC', { status: 'unmet' }, '/no/existe.db'))
  })
})
