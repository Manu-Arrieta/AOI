/**
 * scripts/aoi-os/ontology/semantic-fabric.mjs
 *
 * Deterministic Semantic Ontology & Knowledge Fabric for AOI-OS:
 * In-memory topological graph mapping domain concepts, task IDs, AST symbols,
 * and ICM topics for instant semantic distance and domain impact queries (0 LLM Tokens).
 */

/**
 * Creates an in-memory Semantic Knowledge Fabric instance.
 *
 * @returns {object} Knowledge fabric instance
 */
export function createSemanticFabric() {
  const nodes = new Map() // nodeId -> { id, type, label, attributes }
  const edges = new Map() // fromNodeId -> Set<{ to, relation, weight }>

  /**
   * Adds or updates a node in the fabric.
   *
   * @param {string} id
   * @param {'domain'|'task'|'symbol'|'memory_topic'} type
   * @param {string} label
   * @param {object} [attributes={}]
   */
  function addNode(id, type, label, attributes = {}) {
    nodes.set(id, { id, type, label, attributes })
    if (!edges.has(id)) {
      edges.set(id, new Set())
    }
  }

  /**
   * Adds a directional relation between two nodes.
   *
   * @param {string} fromId
   * @param {string} toId
   * @param {string} relation (e.g. 'implements', 'depends_on', 'touches_domain')
   * @param {number} [weight=1]
   */
  function addEdge(fromId, toId, relation, weight = 1) {
    if (!nodes.has(fromId)) addNode(fromId, 'domain', fromId)
    if (!nodes.has(toId)) addNode(toId, 'domain', toId)

    edges.get(fromId).add({ to: toId, relation, weight })
  }

  /**
   * Queries nodes connected to a concept within maxHops.
   *
   * @param {string} startId
   * @param {number} [maxHops=2]
   * @returns {Array<{ node: object, hops: number, relationPath: string[] }>}
   */
  function queryRelatedNodes(startId, maxHops = 2) {
    if (!nodes.has(startId)) return []

    const results = []
    const visited = new Set([startId])
    const queue = [{ id: startId, hops: 0, path: [] }]

    while (queue.length > 0) {
      const { id, hops, path } = queue.shift()
      if (hops > 0) {
        results.push({
          node: nodes.get(id),
          hops,
          relationPath: path,
        })
      }

      if (hops < maxHops) {
        const neighbors = edges.get(id) || new Set()
        for (const edge of neighbors) {
          if (!visited.has(edge.to)) {
            visited.add(edge.to)
            queue.push({
              id: edge.to,
              hops: hops + 1,
              path: [...path, edge.relation],
            })
          }
        }
      }
    }

    return results
  }

  /**
   * Computes domain impact clusters for a set of tasks.
   *
   * @param {string[]} taskIds
   * @returns {Array<{ domain: string, impactedTasks: string[] }>}
   */
  function computeDomainImpact(taskIds = []) {
    const domainMap = new Map()

    for (const taskId of taskIds) {
      const related = queryRelatedNodes(taskId, 2)
      for (const item of related) {
        if (item.node.type === 'domain') {
          const domainLabel = item.node.label
          if (!domainMap.has(domainLabel)) {
            domainMap.set(domainLabel, new Set())
          }
          domainMap.get(domainLabel).add(taskId)
        }
      }
    }

    return Array.from(domainMap.entries()).map(([domain, taskSet]) => ({
      domain,
      impactedTasks: Array.from(taskSet),
    }))
  }

  return {
    addNode,
    addEdge,
    queryRelatedNodes,
    computeDomainImpact,
    getNodeCount: () => nodes.size,
  }
}
