/**
 * scripts/aoi-os/dag-engine/adaptive-wave-balancer.mjs
 *
 * Deterministic Adaptive Wave Worker Balancer for AOI-OS:
 * Distributes tasks within a parallel wave across worker threads using
 * greedy bin-packing to minimize latency and CPU bottlenecks (0 LLM Tokens).
 */

/**
 * Balances an array of tasks across worker slots based on weight.
 *
 * @param {Array<{ id: string, weight?: number, title?: string }>} tasks
 * @param {number} [workerCount=3]
 * @returns {object} Balanced partition plan
 */
export function balanceWaveTasks(tasks = [], workerCount = 3) {
  if (!tasks.length) {
    return {
      workerCount,
      partitions: Array.from({ length: workerCount }, () => []),
      partitionWeights: Array.from({ length: workerCount }, () => 0),
      balanceEfficiency: 100,
    }
  }

  // Sort tasks in descending order of weight (or default 10 if not set)
  const sortedTasks = [...tasks].sort((a, b) => (b.weight ?? 10) - (a.weight ?? 10))

  const partitions = Array.from({ length: workerCount }, () => [])
  const partitionWeights = Array.from({ length: workerCount }, () => 0)

  // Greedy bin-packing: assign each task to the partition with lowest current weight
  for (const task of sortedTasks) {
    const taskWeight = task.weight ?? 10
    let minIndex = 0
    let minWeight = partitionWeights[0]

    for (let i = 1; i < workerCount; i++) {
      if (partitionWeights[i] < minWeight) {
        minWeight = partitionWeights[i]
        minIndex = i
      }
    }

    partitions[minIndex].push(task)
    partitionWeights[minIndex] += taskWeight
  }

  const maxWeight = Math.max(...partitionWeights)
  const minWeight = Math.min(...partitionWeights)
  const balanceEfficiency = maxWeight === 0 ? 100 : Math.round((minWeight / maxWeight) * 100)

  return {
    workerCount,
    partitions,
    partitionWeights,
    balanceEfficiency,
  }
}
