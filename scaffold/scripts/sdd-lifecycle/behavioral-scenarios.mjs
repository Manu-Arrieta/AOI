/**
 * scripts/sdd-lifecycle/behavioral-scenarios.mjs
 *
 * El punto de ensamblado de las sondas del eval conductual: una decisión, un
 * caso concreto y la respuesta que prueba que la decisión sobrevivió.
 *
 * Este archivo ya no contiene sondas. Las contiene por mitad del ciclo, cada
 * una en su tabla, y acá sólo se unen en el orden que el ciclo recorre:
 *
 *   - `behavioral-scenarios-genesis.mjs`    Fase -2, la pre-fase
 *   - `behavioral-scenarios-entry.mjs`      lo que se DECIDE, de la idea al plan
 *   - `behavioral-scenarios-execution.mjs`  lo que se ENTREGA, del plan al cierre
 *
 * Por qué está partido. La tabla entera llegó a las 300 LOC exactas del
 * Invariante 5 —cero headroom— y la próxima línea de cualquier persona rompía
 * la build. El límite tenía razón desde el principio, igual que la vez anterior
 * que esta misma tabla lo cruzó: son tablas que crecen con cada compuerta nueva
 * del ciclo, y crecen por motivos distintos según qué mitad del ciclo cubran.
 *
 * El orden del array importa en un solo lugar, y está fijado por un test: la
 * primera sonda tiene que ser la de la Fase -2, la única cuya respuesta correcta
 * es "no puedo determinarlo con este contexto". Por eso los spreads van en
 * orden de ciclo y no por tamaño.
 *
 * @typedef {object} Probe
 * @property {string} id
 * @property {string} cut            Which removal this probe defends against.
 * @property {string} phase          Phase key, so the right context is assembled.
 * @property {string} prompt         Prompt file for that phase.
 * @property {string} scenario       What the agent is asked.
 * @property {RegExp} expected       The answer that proves the decision survived.
 * @property {RegExp} [forbidden]    An answer that proves it did not.
 */

import { ENTRY_PROBES } from './behavioral-scenarios-entry.mjs'
import { EXECUTION_PROBES } from './behavioral-scenarios-execution.mjs'
import { GENESIS_PROBES } from './behavioral-scenarios-genesis.mjs'

export const PROBES = [
  // La Fase -2 primero: es la pre-fase, y el orden del array sigue el ciclo.
  ...GENESIS_PROBES,
  // La mitad que decide: de la idea al plan.
  ...ENTRY_PROBES,
  // La mitad que entrega: del plan al cierre.
  ...EXECUTION_PROBES,
]
