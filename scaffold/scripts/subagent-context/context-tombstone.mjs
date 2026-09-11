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
 * Evaluates whether a newer turn supersedes an older turn.
 * @param {object} older
 * @param {object} newer
 * @returns {boolean}
 */
export function isTurnSuperseded(older, newer) {
  if (!older || !newer) return false
  if (older.id === newer.id) return false

  // Same tool type and target (e.g., test runner, file read of same file)
  if (older.tool === 'test' && newer.tool === 'test') {
    return true
  }

  if (older.tool === 'view_file' && (newer.tool === 'write_file' || newer.tool === 'edit_file') && older.target === newer.target) {
    return true
  }

  if (older.tool === 'view_file' && newer.tool === 'view_file' && older.target === newer.target) {
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
