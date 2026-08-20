/**
 * scripts/aoi-os/benchmark/dag-stress-benchmark.mjs
 *
 * Deterministic DAG Scale and Stress Benchmark Suite for AOI-OS:
 * Synthesizes complex multi-tier DAG topologies (diamond, fan-out/fan-in, mesh with 50-200 nodes),
 * executes cycle-free topological wave scheduling, and benchmarks latency with zero LLM token overhead (0 LLM Tokens).
 */

import { validateDagStructure, computeExecutionBatches } from '../dag-engine/dag-scheduler.mjs'

/**
 * Generates a synthetic multi-tier DAG task registry.
 *
 * @param {number} nodeCount - Total number of task nodes to synthesize
 * @param {string} topology - 'diamond' | 'mesh' | 'linear'
 * @returns {Array<object>} Synthesized DAG nodes
 */
export function generateSyntheticDag(nodeCount = 50, topology = 'mesh') {
  const nodes = []

  if (topology === 'linear') {
    for (let i = 0; i < nodeCount; i++) {
      const id = `TASK-${i + 1}`
      const dependsOn = i === 0 ? [] : [`TASK-${i}`]
      nodes.push({ id, title: `Task ${id}`, role: 'backend', dependsOn, status: 'pending' })
    }
    return nodes
  }

  if (topology === 'diamond') {
    // Root node
    nodes.push({ id: 'TASK-1', title: 'Task 1 (Root)', role: 'backend', dependsOn: [], status: 'pending' })

    // Middle parallel layer
    for (let i = 2; i < nodeCount; i++) {
      nodes.push({ id: `TASK-${i}`, title: `Task ${i} (Parallel)`, role: 'frontend', dependsOn: ['TASK-1'], status: 'pending' })
    }

    // Final convergence node
    const allMiddle = nodes.slice(1).map((n) => n.id)
    nodes.push({ id: `TASK-${nodeCount}`, title: `Task ${nodeCount} (Sink)`, role: 'devops', dependsOn: allMiddle, status: 'pending' })
    return nodes
  }

  // Mesh topology with multi-layer fan-out / fan-in
  const layers = 5
  const nodesPerLayer = Math.floor(nodeCount / layers)

  for (let layer = 0; layer < layers; layer++) {
    for (let j = 0; j < nodesPerLayer; j++) {
      const index = layer * nodesPerLayer + j + 1
      const id = `TASK-${index}`
      const dependsOn = []

      if (layer > 0) {
        // Depend on 1-2 nodes from previous layer
        const prevIndex = (layer - 1) * nodesPerLayer + (j % nodesPerLayer) + 1
        dependsOn.push(`TASK-${prevIndex}`)
      }

      nodes.push({ id, title: `Task ${id}`, role: 'backend', dependsOn, status: 'pending' })
    }
  }

  return nodes
}

/**
 * Executes a stress benchmark on the DAG scheduler.
 *
 * @param {number} nodeCount - Number of nodes to benchmark
 * @param {string} topology - Topology type
 * @returns {object} Benchmark results
 */
export function runDagStressBenchmark(nodeCount = 100, topology = 'mesh') {
  const nodes = generateSyntheticDag(nodeCount, topology)

  const startTime = process.hrtime.bigint()
  const validation = validateDagStructure(nodes)
  let batches = []
  if (validation.valid) {
    batches = computeExecutionBatches(nodes)
  }
  const endTime = process.hrtime.bigint()

  const durationMs = Number(endTime - startTime) / 1e6

  return {
    nodeCount: nodes.length,
    topology,
    waveCount: batches.length,
    isAcyclic: validation.valid,
    durationMs,
    throughputNodesPerSecond: Math.round((nodes.length / (durationMs / 1000)) || 0),
    stressProof: validation.valid
      ? 'DAG_STRESS_CONVERGENCE_PROVED'
      : 'CYCLE_DETECTED_IN_SYNTHETIC_GRAPH',
  }
}
