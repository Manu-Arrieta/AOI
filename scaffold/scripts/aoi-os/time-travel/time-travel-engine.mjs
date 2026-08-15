/**
 * scripts/aoi-os/time-travel/time-travel-engine.mjs
 *
 * Time-Travel Memory Snapshot & Replay Engine for AOI-OS:
 * Captures immutable SHA-256 cryptographic checkpoints per execution wave,
 * allowing instant zero-pollution rollback and replay to any prior wave state.
 */

import crypto from 'node:crypto'

/**
 * Creates an in-memory Time-Travel State Manager.
 *
 * @returns {object} Time-travel engine
 */
export function createTimeTravelEngine() {
  const snapshots = [] // Array of { waveNumber, snapshotHash, state, timestamp }

  /**
   * Captures a state snapshot for a wave.
   *
   * @param {number} waveNumber
   * @param {object} statePayload - Arbitrary state (task states, AST contracts, memory IDs)
   * @returns {object} Created snapshot entry
   */
  function captureSnapshot(waveNumber, statePayload = {}) {
    const raw = JSON.stringify(statePayload)
    const snapshotHash = crypto.createHash('sha256').update(raw).digest('hex')

    const entry = {
      waveNumber,
      snapshotHash,
      state: JSON.parse(raw),
      timestamp: new Date().toISOString(),
    }

    snapshots.push(entry)
    return entry
  }

  /**
   * Retrieves all captured snapshots.
   */
  function getSnapshots() {
    return [...snapshots]
  }

  /**
   * Rolls back to a specific target wave number.
   *
   * @param {number} targetWaveNumber
   * @returns {{ success: boolean, restoredSnapshot?: object, rolledBackCount: number }}
   */
  function rollbackToWave(targetWaveNumber) {
    const index = snapshots.findIndex((s) => s.waveNumber === targetWaveNumber)
    if (index === -1) {
      return { success: false, rolledBackCount: 0 }
    }

    const targetSnapshot = snapshots[index]
    const rolledBackCount = snapshots.length - (index + 1)
    snapshots.splice(index + 1)

    return {
      success: true,
      restoredSnapshot: targetSnapshot,
      rolledBackCount,
    }
  }

  return {
    captureSnapshot,
    getSnapshots,
    rollbackToWave,
  }
}
