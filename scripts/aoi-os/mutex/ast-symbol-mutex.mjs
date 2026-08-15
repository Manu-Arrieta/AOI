/**
 * scripts/aoi-os/mutex/ast-symbol-mutex.mjs
 *
 * Deterministic AST Symbol Mutex & Cross-Wave Concurrency Lock for AOI-OS:
 * Detects file and symbol contention between parallel tasks in the same execution wave,
 * serializing only conflicting symbol mutations while keeping independent tasks fully parallel.
 */

/**
 * Creates an in-memory AST Symbol Mutex for execution wave coordination.
 *
 * @returns {object} Mutex manager
 */
export function createAstSymbolMutex() {
  const activeLocks = new Map() // lockKey -> { taskId, symbol, filePath, lockedAt }
  const lockHistory = []

  /**
   * Evaluates tasks in a wave and identifies contention conflicts.
   *
   * @param {Array<{ id: string, targetFiles?: string[], targetSymbols?: string[] }>} waveTasks
   * @returns {{ hasContention: boolean, conflicts: Array<{ fileOrSymbol: string, taskA: string, taskB: string }> }}
   */
  function detectContention(waveTasks = []) {
    const fileToTask = new Map()
    const symbolToTask = new Map()
    const conflicts = []

    for (const task of waveTasks) {
      // 1. Check file-level contention
      if (task.targetFiles) {
        for (const file of task.targetFiles) {
          if (fileToTask.has(file)) {
            conflicts.push({
              fileOrSymbol: file,
              taskA: fileToTask.get(file),
              taskB: task.id,
              type: 'file_collision',
            })
          } else {
            fileToTask.set(file, task.id)
          }
        }
      }

      // 2. Check symbol-level contention
      if (task.targetSymbols) {
        for (const sym of task.targetSymbols) {
          if (symbolToTask.has(sym)) {
            conflicts.push({
              fileOrSymbol: sym,
              taskA: symbolToTask.get(sym),
              taskB: task.id,
              type: 'symbol_collision',
            })
          } else {
            symbolToTask.set(sym, task.id)
          }
        }
      }
    }

    return {
      hasContention: conflicts.length > 0,
      conflicts,
    }
  }

  /**
   * Acquires a lock for a symbol/file.
   *
   * @param {string} taskId
   * @param {string} lockKey - File path or symbol name
   * @returns {{ acquired: boolean, lockKey: string, heldBy?: string }}
   */
  function acquireLock(taskId, lockKey) {
    if (activeLocks.has(lockKey)) {
      const existing = activeLocks.get(lockKey)
      if (existing.taskId === taskId) {
        return { acquired: true, lockKey }
      }
      return { acquired: false, lockKey, heldBy: existing.taskId }
    }

    const lockEntry = {
      taskId,
      lockKey,
      lockedAt: new Date().toISOString(),
    }
    activeLocks.set(lockKey, lockEntry)
    lockHistory.push(lockEntry)

    return { acquired: true, lockKey }
  }

  /**
   * Releases a lock.
   *
   * @param {string} taskId
   * @param {string} lockKey
   * @returns {boolean}
   */
  function releaseLock(taskId, lockKey) {
    if (!activeLocks.has(lockKey)) return true
    const existing = activeLocks.get(lockKey)
    if (existing.taskId === taskId) {
      activeLocks.delete(lockKey)
      return true
    }
    return false
  }

  /**
   * Releases all locks held by a task.
   *
   * @param {string} taskId
   * @returns {number} Count of released locks
   */
  function releaseTaskLocks(taskId) {
    let count = 0
    for (const [key, lock] of Array.from(activeLocks.entries())) {
      if (lock.taskId === taskId) {
        activeLocks.delete(key)
        count++
      }
    }
    return count
  }

  return {
    detectContention,
    acquireLock,
    releaseLock,
    releaseTaskLocks,
    getActiveLocks: () => Array.from(activeLocks.values()),
  }
}
