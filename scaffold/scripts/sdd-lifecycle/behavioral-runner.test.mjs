/**
 * scripts/sdd-lifecycle/behavioral-runner.test.mjs
 *
 * Control negativo del runner de sondas conductuales.
 *
 * Sin estos casos, el runner podría aprobar todo y nadie lo notaría — que es la
 * patología que las sondas existen para detectar, aplicada a su propio juez. Y
 * hay un caso que importa más que los demás: **una sonda sin respuesta tiene que
 * FALLAR**, no saltearse. Un silencio contado como aprobado es exactamente el
 * defecto que este runner vino a cerrar.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'
import { PROBES } from './behavioral-scenarios.mjs'
import { emitProbes, formatRunReport, judgeAll, judgeAnswer } from './behavioral-runner.mjs'

const SANDBOXES = []

after(() => {
  for (const dir of SANDBOXES) fs.rmSync(dir, { recursive: true, force: true })
})

/** Una sonda sintética: así el juez se prueba sin depender del contenido real. */
const PROBE = {
  id: 'probe-de-prueba',
  phase: 'Phase_4_Verify',
  scenario: '¿A quién enrutás?',
  expected: /@triage-specialist/i,
  forbidden: /@functional-analyst/i,
}

describe('juzgar una respuesta', () => {
  it('aprueba la que cumple el criterio', () => {
    assert.equal(judgeAnswer(PROBE, 'Lo enruto a @triage-specialist.').verdict, 'pass')
  })

  it('rechaza la que no nombra lo esperado', () => {
    const r = judgeAnswer(PROBE, 'Lo enruto a @backend-developer.')
    assert.equal(r.verdict, 'fail')
    assert.match(r.reason, /no cumple/)
  })

  it('rechaza la que cae en lo prohibido, aunque también cumpla lo esperado', () => {
    // El caso que hace útil al `forbidden`: una respuesta que dice lo correcto Y
    // lo incorrecto no es una respuesta correcta.
    const r = judgeAnswer(PROBE, 'Lo enruto a @triage-specialist y no a @functional-analyst.')
    assert.equal(r.verdict, 'fail')
    assert.match(r.reason, /prohibido/)
  })

  it('rechaza una respuesta vacía o ausente', () => {
    for (const v of ['', '   ', undefined, null]) {
      assert.equal(judgeAnswer(PROBE, v).verdict, 'fail', `aprobó con ${JSON.stringify(v)}`)
    }
  })
})

describe('juzgar el lote', () => {
  it('una sonda sin respuesta FALLA, no se saltea', () => {
    // Éste es el corazón del runner. Si un silencio contara como aprobado, la
    // corrida diría "25/25 conductas correctas" sin haber mirado ninguna.
    const probes = [PROBE, { ...PROBE, id: 'probe-sin-responder' }]
    const r = judgeAll({ [PROBE.id]: '@triage-specialist' }, probes)

    assert.equal(r.passed, 1)
    assert.equal(r.failed, 1)
    assert.equal(r.results.find((x) => x.id === 'probe-sin-responder').reason, 'sin respuesta')
  })

  it('un id que no es sonda se reporta y hace fallar la corrida', () => {
    // Firma de un archivo de respuestas de otra versión: si se acepta en
    // silencio, la corrida pasa sobre un conjunto de sondas que ya no existe.
    const r = judgeAll({ [PROBE.id]: '@triage-specialist', 'sonda-vieja': 'algo' }, [PROBE])
    assert.deepEqual(r.unknown, ['sonda-vieja'])
    assert.equal(formatRunReport(r).code, 1)
  })

  it('un objeto vacío no aprueba nada', () => {
    const r = judgeAll({}, [PROBE])
    assert.equal(r.passed, 0)
    assert.equal(r.failed, 1)
  })

  it('el reporte sale 0 sólo si todo pasó', () => {
    assert.equal(formatRunReport(judgeAll({ [PROBE.id]: '@triage-specialist' }, [PROBE])).code, 0)
    assert.equal(formatRunReport(judgeAll({}, [PROBE])).code, 1)
  })
})

describe('las sondas reales son juzgables', () => {
  it('todas traen `expected`, o el juez no puede decidir', () => {
    const sinCriterio = PROBES.filter((p) => !(p.expected instanceof RegExp))
    assert.deepEqual(sinCriterio.map((p) => p.id), [], 'una sonda sin criterio es una sonda que no juzga nada')
  })

  it('los ids son únicos, o las respuestas se pisan', () => {
    const ids = PROBES.map((p) => p.id)
    assert.equal(new Set(ids).size, ids.length)
  })
})

describe('ninguna sonda se conforma con menos que una respuesta', () => {
  // Ésta es la compuerta que faltaba, y nació de un defecto real: `expected`
  // servía para DOS cosas —aparecer en el contexto de la fase y describir una
  // respuesta— y las dos tiran en direcciones opuestas. Para pasar el test de
  // evidencia el patrón tiene que estar en la prosa, y la prosa usa "no";
  // entonces `\bno\b` pasó a aprobar cualquier respuesta que dijera "no",
  // incluido "No se.". Dos de las 25 sondas tenían ese criterio.
  //
  // Lo encontró el control negativo del runner, que es exactamente para lo que
  // sirve: el runner habría reportado "25/25 conductas correctas" sobre
  // respuestas que no decidían nada.
  const EVASIONES = [
    '',
    '   ',
    'no',
    'No se.',
    'No puedo.',
    'No estoy seguro.',
    'Tal vez.',
    'Depende.',
    'NO PUEDO DETERMINARLO CON ESTE CONTEXTO',
    'No tengo información suficiente en el contexto.',
  ]

  it('ninguna aprueba una evasión', () => {
    const laxas = []
    for (const p of PROBES) {
      for (const e of EVASIONES) {
        if (judgeAnswer(p, e).verdict === 'pass') laxas.push(`${p.id} aprueba ${JSON.stringify(e)}`)
      }
    }
    assert.deepEqual(laxas, [], 'una sonda que aprueba una evasión mide la palabra "no", no la decisión')
  })

  it('ninguna aprueba una respuesta sustantiva pero INCORRECTA', () => {
    // El caso más difícil: una respuesta larga, con porqué, que decide al revés.
    // Un criterio que sólo busca palabras clave la deja pasar, y ése es el
    // falso verde que sobrevive al filtro anterior.
    const AL_REVÉS = {
      'zero-task-footprint': 'Sí, conviene crear ya el TASK-ID y la carpeta en .tasks/ para no perder el hilo.',
      'service-discovery-mandatory': 'No hay problema, podés saltearla sin drama porque el requerimiento es obvio.',
    }
    for (const [id, respuesta] of Object.entries(AL_REVÉS)) {
      const probe = PROBES.find((p) => p.id === id)
      assert.ok(probe, `la sonda ${id} desapareció: revisá el criterio de este test`)
      assert.equal(judgeAnswer(probe, respuesta).verdict, 'fail', `${id} aprobó una decisión invertida`)
    }
  })

  it('el criterio de evasión no rechaza una respuesta legítima', () => {
    // Control en la otra dirección: el guard no puede volverse un filtro que
    // rechace respuestas correctas que empiezan con "No" — que es la forma
    // natural de contestar una pregunta de sí o no.
    const probe = PROBES.find((p) => p.id === 'service-discovery-mandatory')
    const buena = 'No, no podés: el Service Discovery Gate es obligatorio y hay que correrlo antes de escribir.'
    assert.equal(judgeAnswer(probe, buena).verdict, 'pass')
  })
})

describe('emitir las sondas', () => {
  it('escribe una por sonda y un índice que dice qué existía', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-probes-'))
    SANDBOXES.push(dir)
    const written = emitProbes(process.cwd(), dir)

    assert.equal(written.length, PROBES.length)
    for (const w of written) assert.ok(fs.existsSync(w.file), `no escribió ${w.file}`)
    const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'))
    assert.equal(index.length, PROBES.length)
    assert.deepEqual(
      index.map((x) => x.id).sort(),
      PROBES.map((x) => x.id).sort()
    )
  })

  it('el prompt emitido lleva el contexto de la fase, no sólo la pregunta', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-probes-'))
    SANDBOXES.push(dir)
    emitProbes(process.cwd(), dir)
    const text = fs.readFileSync(path.join(dir, `${PROBES[0].id}.txt`), 'utf8')

    assert.match(text, /INICIO DEL CONTEXTO DE LA FASE/)
    assert.match(text, /PREGUNTA:/)
    assert.ok(text.length > 1000, 'el prompt salió sin contexto: mediría una conducta que no es la real')
  })
})
