/**
 * scripts/sdd-lifecycle/behavioral-scenarios-genesis.mjs
 *
 * Los escenarios conductuales de la Fase -2 (`/sdd-genesis`).
 *
 * POR QUÉ ESTÁN SEPARADOS
 *
 * `behavioral-scenarios.mjs` es una tabla que se alarga con cada compuerta nueva
 * del ciclo — y el propio archivo lo anticipa. Al sumar las tres sondas de la
 * Génesis cruzó las 300 LOC del Invariante 5, y el corte que correspondía no era
 * "las últimas tres que escribí" sino una frontera real: **la Fase -2 no
 * pertenece al ciclo 0–5**. Es la pre-fase, anterior incluso al Pre-Flight, y
 * sus decisiones son de otra naturaleza — qué se aprueba, qué no se materializa,
 * dónde se produce un artefacto derivado.
 *
 * Mismo precedente que `blueprint-diagram.mjs` y `genesis-phase.mjs`: cuando un
 * archivo llega al límite, el límite obliga a nombrar una frontera que ya
 * existía, no a inventar una.
 *
 * @typedef {import('./behavioral-scenarios.mjs').Probe} Probe
 */

/** @type {Probe[]} */
export const GENESIS_PROBES = [
  {
    id: 'genesis-approval-meaning',
    cut: 'La aclaración de que el Genesis Gate aprueba coherencia y no correctitud sacó del prompt',
    phase: 'Phase_-2_Genesis',
    prompt: '.github/prompts/sdd-genesis.prompt.md',
    scenario:
      'El Owner aprueba el blueprint y pregunta: "¿esto significa que la arquitectura está bien?". ' +
      '¿Qué le respondés y por qué? Respondé en dos líneas, nombrando qué es lo que se aprueba y qué falta para saber si es correcta.',
    expected: /coheren|hip[oó]tesis|tracer/i,
    // Si el agente responde que aprobar valida la arquitectura, la aclaración
    // se perdió y el Owner queda creyendo que tiene una garantía que no tiene.
    forbidden: /s[ií],?\s+(est[áa]|queda)\s+(correcta|validada|garantizada)/i,
  },
  {
    id: 'genesis-zero-footprint',
    cut: 'El Zero-Task Footprint de la Fase -2 sacó del prompt',
    phase: 'Phase_-2_Genesis',
    prompt: '.github/prompts/sdd-genesis.prompt.md',
    scenario:
      'El Owner describe una idea y dice "dale, arranquemos". ' +
      '¿Qué hacés en este momento y qué NO hacés todavía? Respondé en dos líneas, nombrando explícitamente qué archivos o identificadores no creás.',
    expected: /no\s+(cre|gener|aloc)|sin\s+(task|crear)|ef[ií]mer/i,
    forbidden: /creo\s+(el\s+)?TASK-|genero\s+(el\s+)?BIC-/i,
  },
  {
    id: 'genesis-diagram-deferred',
    cut: 'La aclaración de que los diagramas se producen en /sdd-apply, no en la génesis',
    phase: 'Phase_-2_Genesis',
    prompt: '.github/prompts/sdd-genesis.prompt.md',
    scenario:
      'El blueprint declara que dos componentes se comunican. El Owner pide ver el diagrama de ese flujo ahora mismo. ' +
      '¿Qué hacés con esa obligación en esta fase? Respondé en dos líneas, nombrando en qué fase se produce el artefacto.',
    expected: /sdd-apply|apply|obligaci[oó]n|registr/i,
    forbidden: /^.*(lo genero|lo dibujo) (ahora|ac[aá]).*$/im,
  },
]
