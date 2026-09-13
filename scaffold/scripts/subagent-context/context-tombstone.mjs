#!/usr/bin/env node
/**
 * scripts/subagent-context/context-tombstone.mjs
 *
 * AOI Context Tombstoning & Dynamic Turn Shrinker.
 * Detects superseded tool outputs (e.g. resolved test failures, outdated file reads)
 * and replaces bulky multi-turn payloads with compact 1-line tombstones.
 * Prevents quadratic context window explosion (O(N^2) -> O(N)) while exporting
 * resolved error artifacts directly into ICM persistent memory.
 */

/**
 * ¿Los dos turnos hablan del MISMO archivo?
 *
 * No alcanza con `older.target === newer.target`, y el motivo es el mismo
 * defecto que ya estaba en la comparación de `id`: **`undefined === undefined`
 * es verdadero**. Dos LECTURAS de archivos distintos, ninguna con `target`,
 * quedaban declaradas iguales y la segunda tumbaba a la primera: el contenido
 * del archivo `a` se reemplazaba por una tumba porque alguien leyó el `b`.
 *
 * La regla es la del lado conservador: sólo se puede PROBAR que el objetivo es
 * el mismo cuando los dos lo declaran y coinciden. Un objetivo ausente no es
 * evidencia de coincidencia.
 *
 * Y por qué `test` no usa esto: la rama de `test` sí supera cuando ninguno
 * declara objetivo, y no es una inconsistencia. Ahí lo que se compara es el
 * ESTADO de una suite, no la identidad de un archivo —un turno de test sin
 * `target` sigue siendo "la corrida de tests"—, así que un objetivo ausente se
 * lee como el mismo flujo lógico. En `view_file` la identidad ES el archivo: sin
 * archivo no hay nada que comparar, y afirmar igualdad sería inventarla.
 */
function sameTarget(older, newer) {
  return older.target != null && older.target === newer.target
}

/**
 * Evaluates whether a newer turn supersedes an older turn.
 * @param {object} older
 * @param {object} newer
 * @returns {boolean}
 */
export function isTurnSuperseded(older, newer) {
  if (!older || !newer) return false
  // Sólo es el MISMO turno si los dos declaran id. Con los dos en `undefined`
  // —turnos que no lo traen— la comparación daba `undefined === undefined`,
  // o sea verdadera, así que se los declaraba "el mismo turno" y NUNCA se
  // tumbaban: un falso NEGATIVO que apagaba la compresión justo en el caso
  // en que más turnos hay.
  if (older.id != null && older.id === newer.id) return false

  // Dos corridas de test se superan sólo si son sobre el MISMO objetivo.
  // El comentario siempre dijo "same tool type and target"; el código sólo
  // miraba el tipo, así que la corrida de `a.test.ts` quedaba tumbada por la
  // de `b.test.ts` y el diagnóstico de `a` se destruía. Un `target` ausente no
  // es evidencia de un objetivo distinto: sólo se puede PROBAR una diferencia
  // cuando los dos lo declaran y difieren.
  if (older.tool === 'test' && newer.tool === 'test') {
    return older.target == null || newer.target == null || older.target === newer.target
  }

  // `view_file` y no `read_file`: el comentario nombraba una herramienta que
  // no existe en ninguno de los dos árboles, y una rama que nunca corre se lee
  // como cobertura.
  if (older.tool === 'view_file' && (newer.tool === 'write_file' || newer.tool === 'edit_file') && sameTarget(older, newer)) {
    return true
  }

  if (older.tool === 'view_file' && newer.tool === 'view_file' && sameTarget(older, newer)) {
    return true
  }

  return false
}

/**
 * Creates a compact tombstone string for a superseded turn.
 * @param {object} turn
 * @param {object} [replacementTurn]
 * @returns {string}
 */
export function createTombstone(turn, replacementTurn) {
  const reason = replacementTurn ? `SUPERSEDED by Turn ${replacementTurn.turnNumber || ''}`.trim() : 'SUPERSEDED'
  const summary = turn.summary || `${turn.tool || 'tool'} execution`
  return `[Turn ${turn.turnNumber || '?'}: ${summary} — ${reason}]`
}

/**
 * Compresses an array of turn records into a tombstoned sequence.
 * @param {Array<object>} turns
 * @returns {Array<object>}
 */
export function shrinkTurns(turns = []) {
  // The guard used to detect a non-array and then spread it anyway, so
  // `shrinkTurns(null)` threw "turns is not iterable" — a defence that
  // crashes on exactly the input it was written for. A string fared no
  // better: it spread into one entry per character.
  if (!Array.isArray(turns)) return []
  if (turns.length <= 1) return [...turns]

  const result = []

  for (let i = 0; i < turns.length; i++) {
    const current = turns[i]
    let supersededBy = null

    // Look ahead to see if any later turn supersedes the current turn
    for (let j = i + 1; j < turns.length; j++) {
      if (isTurnSuperseded(current, turns[j])) {
        supersededBy = turns[j]
        break
      }
    }

    if (supersededBy) {
      result.push({
        ...current,
        isTombstone: true,
        content: createTombstone(current, supersededBy),
        originalLength: (current.content || '').length
      })
    } else {
      result.push(current)
    }
  }

  return result
}

/**
 * Builds an ICM store command payload for any resolved error discovered in tombstones.
 * @param {object} supersededTurn
 * @param {object} resolutionTurn
 * @returns {{ topic: string, content: string, importance: string }|null}
 */
export function buildTombstoneIcmRecord(supersededTurn, resolutionTurn) {
  if (!supersededTurn || !supersededTurn.error) return null

  return {
    topic: 'errors-resolved',
    importance: 'high',
    content: `Resolved ${supersededTurn.summary || 'defect'}: ${supersededTurn.error}. Fixed in Turn ${resolutionTurn?.turnNumber || 'later'}.`
  }
}
