/**
 * scripts/aoi-os/memory-linker/icm-memory-linker.mjs
 *
 * Semantic Memory Differential Graph & ICM Auto-Sync Linker for AOI-OS:
 * Automatically extracts structured decisions, resolved errors, and operational context
 * from task execution results, builds relational links, and syncs into ICM persistent memory.
 */

/**
 * Generates structured ICM memory objects from task execution results.
 *
 * @param {object} options
 * @param {string} options.workspace - Workspace name
 * @param {string} options.feature - Active feature identifier
 * @param {string} options.taskId - Unique task ID
 * @param {string} options.taskTitle - Title of the completed task
 * @param {string} [options.role='general'] - Role assigned to task
 * @param {string[]} [options.decisions=[]] - Architectural/design decisions made
 * @param {string[]} [options.resolvedErrors=[]] - Test/runtime errors diagnosed & fixed
 * @param {string} [options.diffSummary=''] - Summary of files modified
 * @param {string[]} [options.dependsOn=[]] - Dependent task IDs
 * @returns {object} Formatted memory payload
 */
export function generateTaskMemoryPayload(options) {
  const {
    workspace,
    feature,
    taskId,
    taskTitle,
    role = 'general',
    decisions = [],
    resolvedErrors = [],
    diffSummary = '',
    dependsOn = [],
  } = options

  if (!workspace || !taskId) {
    throw new Error('generateTaskMemoryPayload requires workspace and taskId.')
  }

  const memories = []

  // 1. Decisions memory (if any decisions recorded)
  if (decisions.length > 0) {
    memories.push({
      topic: `decisions-${workspace}`,
      importance: 'high',
      content: `[${taskId}] (${taskTitle}): ${decisions.join(' | ')}`,
      keywords: [feature, taskId, 'architecture', role].join(','),
      relations: {
        implements: taskId,
        depends_on: dependsOn,
      },
    })
  }

  // 2. Errors resolved memory (if self-healing occurred)
  if (resolvedErrors.length > 0) {
    memories.push({
      topic: 'errors-resolved',
      importance: 'high',
      content: `[${workspace}:${taskId}] Self-healing resolved: ${resolvedErrors.join(' | ')}`,
      keywords: [workspace, feature, taskId, 'self-healing'].join(','),
      relations: {
        verifies: taskId,
      },
    })
  }

  // 3. Operational task context summary memory
  const summaryParts = [
    `Task [${taskId}] (${taskTitle}) completed by @${role}.`,
    diffSummary ? `Modified: ${diffSummary}.` : '',
    decisions.length ? `Decisions: ${decisions.length}.` : '',
    resolvedErrors.length ? `Self-healed: ${resolvedErrors.length} issue(s).` : '',
  ]
    .filter(Boolean)
    .join(' ')

  memories.push({
    topic: `context-${workspace}`,
    importance: 'high',
    content: summaryParts,
    keywords: [workspace, feature, taskId, role, 'aoi-os'].join(','),
    relations: {
      implements: taskId,
      depends_on: dependsOn,
    },
  })

  return {
    workspace,
    taskId,
    feature,
    timestamp: new Date().toISOString(),
    memories,
  }
}

/**
 * Builds array of CLI commands to store memories in ICM.
 *
 * @param {object} memoryPayload
 * @returns {string[]} List of executable CLI strings
 */
export function buildIcmCliCommands(memoryPayload) {
  if (!memoryPayload?.memories) return []

  return memoryPayload.memories.map((mem) => {
    const escapedContent = mem.content.replace(/"/g, '\\"')
    const keywordArg = mem.keywords ? ` -k "${mem.keywords}"` : ''
    return `icm store -t "${mem.topic}" -c "${escapedContent}" -i ${mem.importance}${keywordArg}`
  })
}

/**
 * Programmatically syncs memory payload via provided execution callback or mock runner.
 *
 * @param {object} memoryPayload
 * @param {Function} [execFn] - Async function (command: string) => Promise<{ stdout: string }>
 * @returns {Promise<{ executedCount: number, commands: string[] }>}
 */
export async function syncTaskToIcm(memoryPayload, execFn = null) {
  const commands = buildIcmCliCommands(memoryPayload)
  let executedCount = 0

  if (execFn && typeof execFn === 'function') {
    for (const cmd of commands) {
      await execFn(cmd)
      executedCount++
    }
  }

  return {
    executedCount,
    commands,
  }
}
