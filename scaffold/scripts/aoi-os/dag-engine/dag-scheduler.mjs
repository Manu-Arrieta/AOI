/**
 * scripts/aoi-os/dag-engine/dag-scheduler.mjs
 *
 * Validates DAG structure, computes topological execution waves (parallel batches),
 * and manages atomic state transitions for autonomous task workflows.
 */

/**
 * Validates DAG for cycles and unresolved dependency references.
 *
 * @param {import('./dag-parser.mjs').DagNode[]} nodes
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDagStructure(nodes) {
  const errors = []
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  // 1. Check for missing dependencies
  for (const node of nodes) {
    for (const depId of node.dependsOn) {
      if (!nodeMap.has(depId)) {
        errors.push(`Task [${node.id}] depends on non-existent task [${depId}].`)
      }
    }
  }

  // 2. Check for cycles via DFS (0 = unvisited, 1 = visiting, 2 = visited)
  const state = new Map()
  for (const node of nodes) state.set(node.id, 0)

  function dfs(nodeId, path) {
    state.set(nodeId, 1)
    const node = nodeMap.get(nodeId)
    if (!node) return

    for (const depId of node.dependsOn) {
      if (state.get(depId) === 1) {
        errors.push(`Cycle detected: ${[...path, nodeId, depId].join(' -> ')}`)
        return
      }
      if (state.get(depId) === 0) {
        dfs(depId, [...path, nodeId])
      }
    }
    state.set(nodeId, 2)
  }

  for (const node of nodes) {
    if (state.get(node.id) === 0) {
      dfs(node.id, [])
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Computes execution waves (parallel execution batches) based on dependencies.
 * Each wave contains tasks that can run simultaneously once previous waves complete.
 *
 * @param {import('./dag-parser.mjs').DagNode[]} nodes
 * @returns {Array<import('./dag-parser.mjs').DagNode[]>}
 */
export function computeExecutionBatches(nodes) {
  const validation = validateDagStructure(nodes)
  if (!validation.valid) {
    throw new Error(`Cannot schedule invalid DAG: ${validation.errors.join('; ')}`)
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n }]))
  const remaining = new Set(nodes.map((n) => n.id))
  const completed = new Set(
    nodes.filter((n) => n.status === 'completed').map((n) => n.id)
  )

  const batches = []

  while (remaining.size > 0) {
    const currentWave = []

    for (const id of remaining) {
      const node = nodeMap.get(id)
      const allDepsMet = node.dependsOn.every((depId) => completed.has(depId))

      if (allDepsMet) {
        currentWave.push(node)
      }
    }

    if (currentWave.length === 0) {
      // Unresolvable deadlock or remaining nodes with unsatisfied deps
      break
    }

    batches.push(currentWave)

    for (const node of currentWave) {
      remaining.delete(node.id)
      completed.add(node.id)
    }
  }

  return batches
}

/**
 * Creates an in-memory State Machine Manager for an active DAG.
 *
 * @param {import('./dag-parser.mjs').DagNode[]} initialNodes
 */
export function createTaskStateManager(initialNodes) {
  const nodes = new Map(initialNodes.map((n) => [n.id, { ...n }]))
  const history = []

  function getTask(id) {
    return nodes.get(id) || null
  }

  function getAllTasks() {
    return Array.from(nodes.values())
  }

  function getReadyTasks() {
    const completedIds = new Set(
      Array.from(nodes.values())
        .filter((n) => n.status === 'completed')
        .map((n) => n.id)
    )

    return Array.from(nodes.values()).filter((node) => {
      if (node.status !== 'pending') return false
      return node.dependsOn.every((depId) => completedIds.has(depId))
    })
  }

  function transition(id, newStatus, metadata = {}) {
    const task = nodes.get(id)
    if (!task) throw new Error(`Task [${id}] not found in state manager.`)

    const previousStatus = task.status
    task.status = newStatus
    task.metadata = { ...task.metadata, ...metadata }

    const entry = {
      taskId: id,
      from: previousStatus,
      to: newStatus,
      timestamp: new Date().toISOString(),
      metadata,
    }

    history.push(entry)
    return { task, entry }
  }

  return {
    getTask,
    getAllTasks,
    getReadyTasks,
    transition,
    getHistory: () => [...history],
  }
}
