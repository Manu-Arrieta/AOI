/**
 * scripts/sdd-lifecycle/behavioral-judge.test.mjs
 *
 * Prueba el JUEZ: si una respuesta satisface su sonda.
 *
 * La primera versión vivía dentro de `behavioral-runner.test.mjs` y juzgaba con
 * 15 casos sintéticos que pasaban todos. **Una batería de no-respuestas prueba lo
 * que a uno se le ocurrió escribir**: los agujeros los encontraron correr el juez
 * contra respuestas reales de un modelo y contra una lente adversarial con
 * mandato de refutar. Los textos de acá son los que esa lente usó, verbatim.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, describe, it } from 'node:test'
import { PROBES } from './behavioral-scenarios.mjs'
import { judgeAnswer, judgeAll, NON_ANSWER, SHORT_PROBES, declaredDecision } from './behavioral-judge.mjs'
import { formatRunReport } from './behavioral-runner.mjs'

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

  it('rechaza la que enruta TAMBIÉN al prohibido', () => {
    // El fixture de este caso decía antes `... y no a @functional-analyst`, y
    // esperaba FAIL. Estaba mal: eso es razonamiento correcto —nombrar la opción
    // para descartarla— y el caso afirmaba lo contrario del defecto que decía
    // cubrir. Lo encontró la corrida real contra un modelo, donde una respuesta
    // correcta que escribió "así que no va a /sdd-frame" fue reprobada.
    const r = judgeAnswer(PROBE, 'Lo enruto a @triage-specialist y también a @functional-analyst, los dos pueden mirarlo.')
    assert.equal(r.verdict, 'fail')
    assert.match(r.reason, /sin negar/)
  })

  it('ACEPTA la que nombra lo prohibido para descartarlo', () => {
    // Control en la otra dirección, y es el comportamiento que el juez tiene que
    // tener: excluir explícitamente la opción equivocada es buena respuesta.
    const ok = judgeAnswer(PROBE, 'Lo enruto a @triage-specialist, no a @functional-analyst, porque la regla ya existe.')
    assert.equal(ok.verdict, 'pass', ok.reason)

    const enMedio = judgeAnswer(PROBE, 'Lo enruto a @triage-specialist y ni se me ocurriría pasarlo a @functional-analyst.')
    assert.equal(enMedio.verdict, 'pass', enMedio.reason)
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
    'No sé.',
    'No puedo.',
    'No estoy seguro.',
    'Tal vez.',
    'Depende.',
    'NO PUEDO DETERMINARLO CON ESTE CONTEXTO',
    'No tengo información suficiente en el contexto.',
  ]

  it('NO confunde una oración en castellano con una evasión', () => {
    // El bug que encontró la corrida real, y los tests de arriba no lo veían
    // porque la batería usaba `"No se."` con punto —que igual cae por el piso de
    // longitud— y nunca una oración que contuviera `no se` en el medio. `s[eé]`
    // con el flag `i` matcheaba la palabra `se` normal: tres respuestas
    // correctas y completas de un modelo quedaron marcadas como evasión.
    //
    // Una batería de no-respuestas prueba lo que a uno se le ocurrió escribir.
    // Ésta es la contracara: oraciones legítimas que NO son evasiones.
    const LEGITIMAS = [
      'No, porque la Zero-Task Footprint Invariant exige que NO se genere un TASK-ID en esta fase.',
      'No arranco la implementación: no se cumple la precondición de que design.md exista.',
      'No podés saltarla: el Service Discovery Gate es obligatorio y no se puede omitir.',
      'Se arranca con @integration-specialist, y no se delega a nadie más en esta fase.',
    ]
    const falsos = LEGITIMAS.filter((t) => NON_ANSWER.test(t))
    assert.deepEqual(falsos, [], 'marcó como evasión una oración legítima en castellano')
  })

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

describe('los contraejemplos que la verificación adversarial encontró', () => {
  // Los cuatro hallazgos de la lente que refutó al juez, cada uno con el texto
  // exacto que la lente usó. Todos ejecutados contra `judgeAnswer` real.
  const p = (id) => PROBES.find((x) => x.id === id)

  it('ACEPTA las respuestas correctas que antes reprobaba', () => {
    const correctas = [
      // El piso de 12 caracteres reprobaba las respuestas a las sondas que piden
      // una palabra, el número o el estado. El instrumento contradecía a la sonda.
      ['icm-importance', 'critical'],
      ['srp-limit', '300'],
      ['registry-closure', 'Archivado'],
      // Y `^\s*no\s+puedo` anclado marcaba esta —correcta— como evasión: declara
      // imposible una ACCIÓN, no la capacidad de DECIDIR.
      ['service-discovery-mandatory', 'No puedo saltarla: la compuerta es obligatoria (MANDATORY) en esta fase.'],
    ]
    for (const [id, respuesta] of correctas) {
      const v = judgeAnswer(p(id), respuesta)
      assert.equal(v.verdict, 'pass', `${id} reprobó una respuesta correcta: ${v.reason}`)
    }
  })

  it('RECHAZA las respuestas invertidas que antes pasaban', () => {
    // Las dos primeras enrutaban al agente PROHIBIDO y pasaban: `sin dudarlo` matcheaba
    // la guardia de negación, y `en vez de` negaba la mención ANTERIOR mientras la
    // guardia lo leía como si negara la posterior.
    //
    // Ahora el criterio se evalúa sobre la línea `DECISION:`, que es corta y
    // afirmativa, así que la atribución de la negación deja de importar.
    const invertidas = [
      ['triage-routing', 'DECISION: @functional-analyst\nMOTIVO: Sin dudarlo, enruto aca porque falta una regla nueva.'],
      ['triage-routing', 'DECISION: @functional-analyst\nMOTIVO: En vez de @triage-specialist, conviene este.'],
      ['zero-task-footprint', 'DECISION: Sí, crea el TASK-ID y la carpeta .tasks/ ya.\nMOTIVO: Para no perder el hilo.'],
      ['zero-task-footprint', 'DECISION: No hay problema, crea el TASK-ID y la carpeta .tasks/ ahora mismo.\nMOTIVO: Hay apuro.'],
    ]
    for (const [id, respuesta] of invertidas) {
      assert.equal(judgeAnswer(p(id), respuesta).verdict, 'fail', `${id} aprobó una respuesta invertida`)
    }
  })

  it('RECHAZA las evasiones que antes pasaban', () => {
    const evasiones = [
      'Con este contexto, no puedo decidirlo; me falta informacion.',
      'No se puede determinar con este contexto si falla o advierte.',
      'No tengo información suficiente en el contexto.',
      'Me falta contexto para determinarlo.',
    ]
    // Contra TODAS las sondas, no contra la que a uno se le ocurre: las variantes
    // impersonales pasaban porque el patrón estaba anclado al inicio del string.
    for (const probe of PROBES) {
      for (const e of evasiones) {
        assert.equal(judgeAnswer(probe, e).verdict, 'fail', `${probe.id} aprobó "${e}"`)
      }
    }
  })

  it('exige el porqué cuando la sonda lo pide y el formato está en uso', () => {
    // Cada escenario pide "una línea por qué", y el formato estructurado tiene un
    // campo para eso. Una `DECISION:` sin `MOTIVO:` declara el veredicto y se
    // saltea la mitad de lo que la sonda quiere medir.
    assert.equal(judgeAnswer(p('zero-task-footprint'), 'DECISION: No').verdict, 'fail')
    assert.equal(judgeAnswer(p('triage-routing'), 'DECISION: @triage-specialist').verdict, 'fail')
    // En prosa, sin rótulos, no se exige: decidir y explicar en la misma oración
    // es una respuesta completa.
    assert.equal(
      judgeAnswer(p('zero-task-footprint'), 'No, no se crea el TASK-ID porque la Invariante lo prohíbe.').verdict,
      'pass'
    )
  })

  it('la línea `DECISION:` es lo que evalúa el criterio', () => {
    assert.equal(declaredDecision('DECISION: @triage-specialist\nMOTIVO: x'), '@triage-specialist')
    assert.equal(declaredDecision('sin formato'), null)
  })
})

describe('la marca de sonda corta no puede desincronizarse', () => {
  it('toda sonda cuyo escenario pide una respuesta corta está en SHORT_PROBES', () => {
    // Ésta es la compuerta que impide que la contradicción vuelva: si alguien
    // agrega una sonda que dice "Respondé con el número" y no la marca, el juez
    // le va a exigir 12 caracteres y va a reprobar la respuesta correcta.
    const PIDE_CORTA = /\b(una sola palabra|con el número|con el n[uú]mero|el estado|solo con el nombre|una palabra)\b/i
    const deberian = PROBES.filter((x) => PIDE_CORTA.test(x.scenario)).map((x) => x.id).sort()
    const estan = [...SHORT_PROBES].sort()

    assert.deepEqual(estan, deberian, 'la lista de sondas cortas y los escenarios que piden respuesta corta discrepan')
    assert.ok(estan.length > 0, 'la lista quedó vacía: el chequeo pasaría sin mirar nada')
  })
})
