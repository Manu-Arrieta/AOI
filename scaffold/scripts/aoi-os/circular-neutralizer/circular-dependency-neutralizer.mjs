/**
 * scripts/aoi-os/circular-neutralizer/circular-dependency-neutralizer.mjs
 *
 * Deterministic Circular Dependency Neutralizer & Graph Decoupler for AOI-OS:
 * Builds topological dependency graphs across source files, detecting cycles
 * and proposing automated intermediary contract extractions (0 LLM Tokens).
 */

/**
 * Detects circular import cycles in a module dependency graph.
 *
 * @param {Record<string, string[]>} dependencyGraph - Map of file -> imported files
 * @returns {object} Cycle detection results and decoupling plan
 */
export function neutralizeCircularDependencies(dependencyGraph = {}) {
  const visited = new Set()
  const recursionStack = new Set()
  const detectedCycles = []

  function dfs(node, path = []) {
    visited.add(node)
    recursionStack.add(node)

    const neighbors = dependencyGraph[node] || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path, node])
      } else if (recursionStack.has(neighbor)) {
        const cycle = [...path, node, neighbor]
        detectedCycles.push(cycle)
      }
    }

    recursionStack.delete(node)
  }

  for (const node of Object.keys(dependencyGraph)) {
    if (!visited.has(node)) {
      dfs(node, [])
    }
  }

  const hasCycles = detectedCycles.length > 0
  const decouplingPlans = []

  for (const cycle of detectedCycles) {
    decouplingPlans.push({
      cyclePath: cycle.join(' -> '),
      action: 'EXTRACT_SHARED_INTERFACE_INTERMEDIARY',
      recommendedTarget: `${cycle[0].replace(/\.[^/.]+$/, '')}.types.ts`,
    })
  }

  return {
    hasCycles,
    totalCycles: detectedCycles.length,
    detectedCycles,
    decouplingPlans,
    topologyStatus: hasCycles ? 'CIRCULAR_DEPENDENCIES_DETECTED' : 'ACYCLIC_TOPOLOGY_VERIFIED',
  }
}
