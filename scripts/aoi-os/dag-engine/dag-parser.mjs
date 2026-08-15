/**
 * scripts/aoi-os/dag-engine/dag-parser.mjs
 *
 * Compiles Markdown task breakdowns (tasks.md) into a structured,
 * validated Directed Acyclic Graph (DAG) for autonomous execution.
 */

import { normalizeRole } from '../../subagent-context/sanitize-subagent-payload.mjs'

/**
 * @typedef {Object} DagNode
 * @property {string} id - Unique task identifier (e.g., 'T-1', 'TASK-01')
 * @property {string} title - Task description or title
 * @property {string} role - Assigned agent role (e.g., 'frontend', 'backend', 'devops')
 * @property {string[]} dependsOn - Array of task IDs that must complete before this node
 * @property {string[]} targetFiles - Affected file paths declared in task
 * @property {string} testRequirements - TDD requirements declared for this task
 * @property {'pending'|'ready'|'in_progress'|'completed'|'failed'|'healing'|'blocked'} status
 * @property {Record<string, any>} metadata
 */

/**
 * Parses markdown tasks.md content into an array of DagNodes.
 *
 * @param {string} markdownContent
 * @returns {DagNode[]}
 */
export function parseTaskDag(markdownContent) {
  if (!markdownContent || typeof markdownContent !== 'string') return []

  const taskBlocks = markdownContent.split(/(?=^###\s+Task\s+|^##\s+Task\s+)/m)
  const nodes = []

  for (const block of taskBlocks) {
    const trimmed = block.trim()
    if (!trimmed.startsWith('#')) continue

    const lines = trimmed.split('\n')
    const firstLine = lines[0]

    // Extract ID (e.g. "### Task T-1: Build API endpoint [backend] (Depends on: T-0)")
    const idMatch = firstLine.match(/Task\s+([A-Za-z0-9-_.]+)/i)
    if (!idMatch) continue
    const id = idMatch[1].trim()

    // Extract Role
    const roleMatch = trimmed.match(/\[([a-z0-9-_]+)\]/i) || trimmed.match(/@([a-z0-9-_]+)/i)
    const rawRole = roleMatch ? roleMatch[1] : 'general'
    const role = normalizeRole(rawRole)

    // Extract Dependencies (e.g., "Depends on: T-1, T-2" or "Dependencies: T-1")
    const dependsOn = []
    const depMatch = trimmed.match(/(?:depends\s+on|dependencies|after):\s*([A-Za-z0-9-_.,\s]+)/i)
    if (depMatch) {
      const parsedDeps = depMatch[1]
        .split(/[,\s]+/)
        .map((d) => d.trim().replace(/^Task\s*/i, ''))
        .filter((d) => Boolean(d) && d.toLowerCase() !== 'none' && d.toLowerCase() !== 'n/a')
      for (const dep of parsedDeps) {
        if (!dependsOn.includes(dep)) dependsOn.push(dep)
      }
    }

    // Extract Target Files
    const targetFiles = []
    const fileMatches = trimmed.matchAll(/`([^`]+\.[a-z0-9]+)`/gi)
    for (const match of fileMatches) {
      const filePath = match[1].trim()
      if (!targetFiles.includes(filePath) && !filePath.includes(' ') && filePath.includes('.')) {
        targetFiles.push(filePath)
      }
    }

    // Extract TDD / Test Requirements block
    let testRequirements = ''
    const tddMatch = trimmed.match(/(?:##+\s*(?:Test Requirements|TDD|Tests?)[\s\S]*?)(?=\n##+|$)/i)
    if (tddMatch) {
      testRequirements = tddMatch[0].trim()
    }

    const isCompleted = /\[x\]/i.test(firstLine) || /Status:\s*Completed/i.test(trimmed)

    nodes.push({
      id,
      title: firstLine.replace(/^#+\s*/, '').trim(),
      role,
      dependsOn,
      targetFiles,
      testRequirements,
      status: isCompleted ? 'completed' : 'pending',
      metadata: {
        rawBlock: trimmed,
      },
    })
  }

  return nodes
}
