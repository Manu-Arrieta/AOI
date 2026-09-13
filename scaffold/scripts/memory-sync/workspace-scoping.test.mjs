/**
 * scripts/memory-sync/workspace-scoping.test.mjs
 *
 * El aislamiento entre workspaces, que es el predicado más consecuente del área.
 *
 * `isWorkspaceScopedTopic` decide qué memoria entra en un bundle. Si clasifica de
 * MÁS, un workspace exporta memoria de otro — que es exactamente lo que el
 * protocolo ICM dice que no puede pasar. Se exportó para probarla sola, igual que
 * `restoreTrackedFiles` en el sandbox: una función que decide aislamiento tiene
 * que poder probarse sin montar el ciclo completo.
 *
 * Por qué no tenía cobertura y qué la hacía difícil de matar. La función es una
 * cadena de seis ramas con `||`, y el mutador la ataca por los dos lados:
 *
 *   `eq→ne`   `topic !== "ws-context"` es verdadero para CASI TODO, así que la
 *             función pasa a devolver `true` siempre. Se mata con UN caso que
 *             deba dar `false` — que es el que ninguna prueba tenía.
 *
 *   `or→and`  encadena las ramas con `&&`, y como las comparaciones son
 *             mutuamente excluyentes el resultado es `false` siempre. Se mata con
 *             **un caso por rama**: si sólo se prueba una, las otras cinco quedan
 *             sin ejercitar y sus mutantes sobreviven.
 *
 * O sea: la tabla de abajo no es exhaustiva por completitud, es la condición para
 * que los mutantes de la cadena puedan morir. **Un caso por rama, y un caso que
 * deba dar falso.**
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isWorkspaceScopedTopic } from './export-memory-bundle.mjs'

const WS = 'mi-proyecto'

describe('isWorkspaceScopedTopic: una rama por caso, y un caso que debe dar falso', () => {
  // Un caso por rama, con el orden de la función. Los cinco primeros son los
  // que matan los `or→and`; el último es el que mata los `eq→ne`.
  const CASOS = [
    [`${WS}-context`, true, 'la rama del topic de contexto'],
    [`${WS}-session-summaries`, true, 'la rama de los resúmenes de sesión'],
    [`${WS}-errors-resolved`, true, 'la rama de los errores resueltos'],
    [`${WS}-cualquier-otra-cosa`, true, 'el prefijo del workspace'],
    [`sdd-${WS}-TASK-2026-001`, true, 'el prefijo de tarea SDD'],
    [`sandbox-${WS}-experimento`, true, 'el prefijo de sandbox'],
    ['otro-proyecto-context', false, 'un workspace DISTINTO no entra'],
    ['', false, 'la cadena vacía no entra'],
    [WS, false, 'el nombre pelado, sin sufijo, no entra'],
    [`${WS}`, false, 'el nombre pelado otra vez, por si el prefijo se relaja'],
    [`prefijo-${WS}-context`, false, 'un topic que CONTIENE el workspace pero no empieza con él'],
  ]

  for (const [topic, esperado, porque] of CASOS) {
    it(`${esperado ? 'acepta' : 'rechaza'} ${JSON.stringify(topic)} — ${porque}`, () => {
      assert.equal(isWorkspaceScopedTopic(topic, WS), esperado)
    })
  }

  it('el workspace vacío no convierte todo en propio', () => {
    // El caso límite del prefijo: con `workspace = ''`, `startsWith('-')` es
    // falso para casi todo, pero `topic === '-context'` sería verdadero. Vale
    // fijar que un workspace vacío NO hace que todo entre.
    assert.equal(isWorkspaceScopedTopic('cualquier-cosa', ''), false)
    assert.equal(isWorkspaceScopedTopic('-context', ''), true, 'el prefijo vacío sí arma "-context"')
  })

  it('la simplificación es EQUIVALENTE a las seis ramas que tenía', () => {
    // Las tres ramas con `===` —`{ws}-context`, `{ws}-session-summaries`,
    // `{ws}-errors-resolved`— estaban SUBSUMIDAS por `startsWith("{ws}-")`: un
    // topic que empieza con `{ws}-` ya incluye a los tres. Eran ramas muertas, y
    // cada una dejaba dos mutantes equivalentes que ningún test podía matar.
    // Se borraron.
    //
    // Esto fija que el borrado no cambió la conducta: la versión de seis ramas
    // contra la de tres, sobre el producto de cuatro workspaces y catorce topics.
    const seisRamas = (topic, ws) =>
      topic === `${ws}-context`
      || topic === `${ws}-session-summaries`
      || topic === `${ws}-errors-resolved`
      || topic.startsWith(`${ws}-`)
      || topic.startsWith(`sdd-${ws}-`)
      || topic.startsWith(`sandbox-${ws}-`)

    const workspaces = ['ws', 'mi-proyecto', 'a', '']
    const topics = [
      'ws-context', 'ws-session-summaries', 'ws-errors-resolved', 'ws-x',
      'sdd-ws-T', 'sandbox-ws-x', 'otro-ws-context', '', 'ws', 'ws-',
      'sdd-ws-', 'sandbox-ws-', 'mi-proyecto-viejo-context', 'context',
    ]

    let difieren = 0
    for (const ws of workspaces) {
      for (const topic of topics) {
        if (seisRamas(topic, ws) !== isWorkspaceScopedTopic(topic, ws)) difieren++
      }
    }
    assert.equal(difieren, 0, `${difieren} combinaciones cambian de resultado`)
    assert.equal(workspaces.length * topics.length, 56, 'la tabla tiene que seguir teniendo 56 combinaciones')
  })

  it('dos workspaces que comparten prefijo: el límite conocido de clasificar por prefijo', () => {
    // Esto NO es un caso que el código acierte ni que yo pueda arreglar acá, y se
    // fija a propósito.
    //
    // `mi-proyecto` y `mi-proyecto-viejo` comparten prefijo, así que un topic de
    // `mi-proyecto-viejo` —`sdd-mi-proyecto-viejo-TASK-1`— empieza con
    // `sdd-mi-proyecto-` y se clasifica como de `mi-proyecto`. Es la MISMA trampa
    // del hermano que el dashboard ya arregló (`.resources-production-backup`
    // colándose por un `startsWith` sin separador), con una diferencia que
    // importa: **acá no hay separador que agregar.**
    //
    // La función recibe `topic` y `workspace`, nada más. Para saber si
    // `sdd-mi-proyecto-viejo-TASK-1` es de otro workspace haría falta la lista de
    // workspaces conocidos, que no tiene. Cualquier arreglo local sería adivinar
    // la forma del sufijo, y un `TASK-` hardcodeado rompería el día que el
    // formato cambie.
    //
    // Así que se fija el comportamiento real y se declara el límite: esto es un
    // techo de la clasificación por prefijo, y quien lo quiera cerrar tiene que
    // pasarle la lista.
    assert.equal(isWorkspaceScopedTopic('mi-proyecto-viejo-context', WS), true, 'el hermano entra por el prefijo')
    assert.equal(isWorkspaceScopedTopic('sdd-mi-proyecto-viejo-TASK-1', WS), true, 'y también por el prefijo de sdd')
    // Lo que SÍ se distingue: un workspace que no comparte el prefijo.
    assert.equal(isWorkspaceScopedTopic('otro-proyecto-context', WS), false)
  })
})
