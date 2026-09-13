/**
 * scripts/sdd-lifecycle/behavioral-judge.mjs
 *
 * Decide si una respuesta satisface su sonda. Nada más: no emite, no orquesta,
 * no lee la línea de comandos.
 *
 * Split de `behavioral-runner.mjs` cuando ese archivo cruzó las 300 LOC del
 * Invariante 5 al arreglar las cuatro formas en que el juez se equivocaba. El
 * corte es real: **juzgar una respuesta** y **orquestar una corrida** son dos
 * trabajos, y el segundo no necesita saber cómo se decide.
 *
 * Las cuatro correcciones que viven acá, y todas salieron de correr el juez
 * contra respuestas reales de un modelo y contra una lente adversarial —no de
 * leerlo:
 *
 *   1. El piso de longitud se aplicaba a las SIETE sondas que piden una respuesta
 *      corta. El instrumento contradecía a la sonda que dice juzgar.
 *   2. La marca de evasión estaba anclada al inicio y aceptaba cualquier verbo,
 *      así que reprobaba *"No puedo saltarla: es obligatoria"* —correcta— y
 *      aprobaba *"Con este contexto, no puedo decidirlo"*.
 *   3. La guardia de negación trataba `sin dudarlo` como una negación, y una
 *      respuesta que enrutaba al agente PROHIBIDO pasaba.
 *   4. Y el fondo: **un regex no puede atribuir una negación a la mención
 *      correcta.** Ver `DECISION_LINE`.
 */

import { PROBES } from './behavioral-scenarios.mjs'

/**
 * Marcas de EVASIÓN: una respuesta que declara no poder decidir no decidió.
 *
 * El prompt de la sonda le da al agente una salida explícita —"respondé NO
 * PUEDO DETERMINARLO CON ESTE CONTEXTO"— para que no invente cuando el contexto
 * no alcanza. Está bien que exista, y por eso hay que verla: contarla como
 * aprobada sería premiar al que se rinde.
 *
 * Dos arreglos medidos, y los dos vinieron de correr el juez contra respuestas
 * reales y contra una lente adversarial:
 *
 *  1. **El verbo tiene que ser COGNITIVO.** La versión anterior decía
 *     `^\\s*no\\s+puedo\\b`, anclado al inicio y con cualquier verbo detrás, así
 *     que marcaba como evasión *"No puedo saltarla: la compuerta es obligatoria"*
 *     — una respuesta CORRECTA que declara imposible una acción. La evasión es
 *     declarar que no se puede **decidir**; no es lo mismo que declarar que algo
 *     no se puede **hacer**.
 *  2. **Sin ancla de inicio.** *"Con este contexto, no puedo decidirlo"* pasaba
 *     porque el patrón sólo miraba el comienzo absoluto del string. Una evasión
 *     no se define por dónde está en la oración.
 */
export const NON_ANSWER =
  /\b(no\s+(puedo|logro|consigo|me\s+es\s+posible)\s+(decidir|determinar|saber|definir|elegir|responder|afirmar|establecer|deducir)|\bno\s+se\s+puede\s+(decidir|determinar|saber|definir|establecer|deducir)|NO PUEDO DETERMINARLO|\bno\s+sé\b|\bno\s+estoy\s+seguro\b|\b(me\s+falta|no\s+tengo|carezco\s+de)\s+(informaci[oó]n|contexto|el\s+contexto)(\s+suficiente)?|sin\s+(el\s+)?contexto\s+(no|es\s+imposible))/i

/**
 * Piso de longitud para las sondas que piden la decisión **y su porqué**.
 *
 * No es una regla de estilo: el criterio juzga una justificación, y sin
 * justificación no hay nada que juzgar. Es también lo que atrapa un `"No se."`
 * pelado, que es por lo que la marca de evasión puede permitirse exigir el acento.
 *
 * **Y NO se aplica a todas las sondas.** Siete de las 25 piden una respuesta
 * corta y explícita —*"Respondé con una sola palabra"*, *"Respondé con el
 * número"*, *"Respondé con el estado"*, *"solo con el nombre del agente"*— así que
 * exigirles 12 caracteres era que **el instrumento contradijera a la sonda que
 * dice juzgar**: `icm-importance` pide `critical` (8 caracteres) y el juez lo
 * reprobaba. Lo declara la propia sonda con `short: true`, y hay una compuerta en
 * `behavioral-runner.test.mjs` que impide que esa marca se desincronice de lo que
 * el escenario pide.
 */
export const MIN_ANSWER_CHARS = 12
export const MIN_SHORT_CHARS = 3

/**
 * Las sondas cuyo escenario pide una respuesta CORTA y explícita.
 *
 * Escrito acá y no inferido del texto del escenario, siguiendo el mismo criterio
 * que `SKILL_SCOPE` en `instruction-scope.mjs`: *"Applicability is written down
 * HERE rather than inferred… Reading intent out of English is the mistake this
 * module already made once"*. Un mapa revisado se puede discutir; un regex que
 * adivina intención, no.
 *
 * Cada entrada cita la frase del escenario que la justifica. Y no es una lista
 * de conveniencia: sin ella, el piso de 12 caracteres reprobaba `critical` (8),
 * `300` (3) y `Archivado` (9) — respuestas correctas a preguntas que piden
 * exactamente eso. Hay una compuerta en `behavioral-runner.test.mjs` que falla si
 * una sonda pide una respuesta corta y no está acá.
 */
export const SHORT_PROBES = new Set([
  'verify-delegation', // "Respondé solo con el nombre del agente."
  'specify-agent', // "Respondé solo con el nombre del agente."
  'plan-agent', // "Respondé solo con el nombre del agente."
  'archive-agent', // "Respondé solo con el nombre."
  'srp-limit', // "Respondé con el número."
  'icm-importance', // "Respondé con una sola palabra."
  'registry-closure', // "Respondé con el estado."
])

/**
 * Expresiones que PARECEN una negación y no lo son.
 *
 * La guardia de `forbidden` mira si hay una negación antes de la mención, y con
 * una lista ingenua de marcadores (*no, ni, sin…*) `sin dudarlo` desactivaba el
 * `forbidden` para todo lo que viniera después. Una respuesta **invertida** como
 * *"Sin dudarlo, enruto a @functional-analyst"* pasaba el filtro por una locución
 * que no niega nada.
 */
export const NO_NEGAN = /\b(sin\s+dudarlo|sin\s+duda|sin\s+problema|sin\s+drama|sin\s+pensarlo|no\s+hay\s+problema|no\s+doubt)\b/gi

/** ¿Hay una negación real a mano antes de `index`? */
function negadoAntes(text, index) {
  const limpio = text
    .slice(Math.max(0, index - 60), index)
    .replace(NO_NEGAN, ' ')
  return /\b(no|ni|nunca|jamás|never|not|tampoco|en\s+vez\s+de|instead\s+of)\b[^.;:]{0,50}$/i.test(limpio)
}

/**
 * ¿La respuesta cae en lo prohibido **de verdad**?
 *
 * Se inspecciona lo que precede a cada coincidencia y, si hay una negación real a
 * mano, esa coincidencia no cuenta. Una mención sin negar sigue siendo violación.
 * Las locuciones que parecen negaciones se borran antes de decidir: ver `NO_NEGAN`.
 *
 * @param {RegExp} forbidden
 * @param {string} text
 * @returns {string|null} la coincidencia que viola, o null
 */
export function findForbidden(forbidden, text) {
  if (!forbidden) return null
  const flags = forbidden.flags.includes('g') ? forbidden.flags : `${forbidden.flags}g`
  for (const m of String(text).matchAll(new RegExp(forbidden.source, flags))) {
    if (!negadoAntes(String(text), m.index)) return m[0]
  }
  return null
}

/**
 * La línea que carga la DECISIÓN, cuando la respuesta usa el formato estructurado.
 *
 * Esto es el arreglo de fondo, y vale explicar por qué no alcanzaba con mejores
 * regex. Una lente adversarial demolió el juez con dos contraejemplos que ningún
 * patrón puede distinguir:
 *
 *   "En vez de @triage-specialist, lo enruto a @functional-analyst."
 *   "Sin dudarlo, enruto a @functional-analyst en vez de @triage-specialist."
 *
 * Las dos enrutan al agente PROHIBIDO. En la primera, *"en vez de"* niega la
 * mención **anterior** y la guardia lo leía como si negara la posterior; en la
 * segunda, *"sin dudarlo"* no niega nada. **Atribuir una negación a la mención
 * correcta es análisis sintáctico, y un regex no lo hace.**
 *
 * La salida no es un patrón más listo: es **darle al juez una línea cuyo único
 * trabajo sea cargar la decisión**. Si la respuesta trae `DECISION:`, el criterio
 * se evalúa ahí —una línea corta y afirmativa, donde las negaciones no juegan— y
 * la evasión y la longitud se siguen mirando sobre el texto completo. Sin esa
 * línea, todo se evalúa sobre el texto completo, como antes.
 *
 * Sigue sin ser una garantía: una `DECISION:` puede mentir. Pero mueve el ataque
 * desde *"esquivar un regex"* hacia *"afirmar explícitamente lo incorrecto"*, que
 * es un terreno mucho más chico y auditable.
 */
export const DECISION_LINE = /^[ \t>*]*DECISION:[ \t]*(.+)$/im

/**
 * La línea que carga el PORQUÉ, cuando la respuesta usa el formato estructurado.
 *
 * Es la contracara de `DECISION_LINE`, y existe porque cada escenario pide *"una
 * línea por qué"* y **el formato tiene un campo para eso**. Una `DECISION:` sin
 * `MOTIVO:` declara el veredicto y se saltea la justificación, que es la mitad de
 * lo que la sonda quiere medir.
 *
 * Sólo se exige cuando el formato está en uso: una respuesta en prosa que decide
 * y explica en la misma oración no tiene por qué llevar el rótulo.
 */
export const MOTIVO_LINE = /^[ \t>*]*MOTIVO:[ \t]*(.+)$/im

/** Extrae la decisión declarada, o `null` si la respuesta no usa el formato. */
export function declaredDecision(text) {
  const m = DECISION_LINE.exec(String(text))
  return m ? m[1].trim() : null
}

/**
 * Juzga una respuesta contra el criterio de su sonda.
 *
 * El orden importa: primero se descarta la evasión y el mutismo, y sólo después
 * se aplica el criterio. Al revés, una evasión que por casualidad contenga una
 * palabra del criterio pasaría — que es exactamente lo que pasaba con las dos
 * sondas cuyo `expected` incluía `\bno\b`.
 *
 * @returns {{ id: string, verdict: 'pass'|'fail', reason: string }}
 */
export function judgeAnswer(probe, answer) {
  if (typeof answer !== 'string' || answer.trim() === '') {
    return { id: probe.id, verdict: 'fail', reason: 'sin respuesta' }
  }
  const text = answer.trim()
  if (NON_ANSWER.test(text)) {
    return { id: probe.id, verdict: 'fail', reason: 'evasión: declara no poder decidir' }
  }

  const esCorta = SHORT_PROBES.has(probe.id)
  const decision = declaredDecision(text)
  const piso = esCorta ? MIN_SHORT_CHARS : MIN_ANSWER_CHARS

  // El largo se mide sobre lo que la sonda pide: si sólo quiere la decisión, la
  // decisión; si quiere la decisión Y el porqué, la respuesta entera —porque el
  // porqué es lo que el piso está cuidando—.
  const aMedir = esCorta ? (decision ?? text) : text
  if (aMedir.length < piso) {
    return { id: probe.id, verdict: 'fail', reason: `respuesta de ${aMedir.length} caracteres: por debajo del piso de ${piso}` }
  }

  // Con formato estructurado, una sonda que pide el porqué exige que el porqué
  // esté. Una `DECISION:` sola declara el veredicto y se saltea la mitad.
  if (decision !== null && !esCorta && !MOTIVO_LINE.test(text)) {
    return { id: probe.id, verdict: 'fail', reason: 'declara la decisión sin el porqué que la sonda pide' }
  }

  // El criterio se evalúa sobre la DECISIÓN cuando existe, y sobre todo el texto
  // cuando no. Ver `DECISION_LINE` para el porqué.
  const objetivo = decision ?? text
  if (!probe.expected.test(objetivo)) {
    return { id: probe.id, verdict: 'fail', reason: `no cumple /${probe.expected.source}/` }
  }
  const violacion = findForbidden(probe.forbidden, objetivo)
  if (violacion) {
    return { id: probe.id, verdict: 'fail', reason: `menciona sin negar lo prohibido: "${violacion}"` }
  }
  return { id: probe.id, verdict: 'pass', reason: 'ok' }
}

/**
 * Juzga el lote completo. Un id presente en las respuestas pero ausente de las
 * sondas también falla: es la firma de un archivo de respuestas de otra versión,
 * y aceptarlo en silencio haría pasar la corrida sobre sondas que ya no existen.
 *
 * Sólo objetos planos: un `Map` habría dejado `Object.keys` vacío y el chequeo
 * de ids desconocidos —la mitad del valor de este paso— pasaría por no mirar.
 *
 * @returns {{ results: Array<object>, passed: number, failed: number, unknown: string[] }}
 */
export function judgeAll(answers, probes = PROBES) {
  const map = answers && typeof answers === 'object' ? answers : {}
  const results = probes.map((p) => judgeAnswer(p, map[p.id]))
  const known = new Set(probes.map((p) => p.id))
  const unknown = Object.keys(map).filter((k) => !known.has(k)).sort()
  const passed = results.filter((r) => r.verdict === 'pass').length
  return { results, passed, failed: results.length - passed, unknown }
}


