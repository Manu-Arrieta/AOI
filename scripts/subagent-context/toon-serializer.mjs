/**
 * scripts/subagent-context/toon-serializer.mjs
 *
 * Token-Optimized Object Notation (TOON) serializer for AOI subagent payloads.
 * Converts verbose JSON/Markdown structures into high-density, type-preserving
 * tabular/bracketed notation, saving 40-60% tokens in subagent task delegation.
 */

/**
 * Serializes task items into compact TOON tabular format.
 *
 * @param {Array<{ id: string, title: string, status: string, content?: string }>} tasks
 * @returns {string}
 */
export function serializeTasksToTOON(tasks = []) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return '::TASKS[empty]::'
  }

  const lines = ['::TASKS[id|status|title]::']
  for (const t of tasks) {
    const cleanId = String(t.id || 'unnamed').replace(/[|\n]/g, ' ').trim()
    const cleanStatus = String(t.status || 'pending').replace(/[|\n]/g, ' ').trim()
    const cleanTitle = String(t.title || '').replace(/[|\n]/g, ' ').trim()
    lines.push(`|${cleanId}|${cleanStatus}|${cleanTitle}|`)

    // If there are detailed contents / TDD requirements, encode them compactly
    if (t.content && t.content.trim()) {
      const details = t.content
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#') && !l.toLowerCase().startsWith('status:'))
        .join('; ')
      if (details) {
        lines.push(`  ↳ details: ${details}`)
      }
    }
  }

  return lines.join('\n')
}

/**
 * Serializes interface and architectural contracts into compact TOON notation.
 *
 * @param {string} contractsText
 * @returns {string}
 */
export function serializeContractsToTOON(contractsText = '') {
  if (!contractsText || typeof contractsText !== 'string' || !contractsText.trim()) {
    return ''
  }

  // Normalize code blocks and prune extraneous blank lines
  const cleaned = contractsText
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return `::CONTRACTS::\n${cleaned}\n::END_CONTRACTS::`
}

/**
 * Serializes linked resources into compact TOON notation.
 *
 * @param {Array<{ kind: string, targetPath?: string, path?: string, description?: string }>} relations
 * @returns {string}
 */
export function serializeRelationsToTOON(relations = []) {
  if (!Array.isArray(relations) || relations.length === 0) {
    return ''
  }

  const lines = ['::RELATIONS[kind|path|desc]::']
  for (const rel of relations) {
    const kind = String(rel.kind || 'resource').replace(/[|\n]/g, ' ').trim()
    const target = String(rel.targetPath || rel.path || '').replace(/[|\n]/g, ' ').trim()
    const desc = String(rel.description || 'context').replace(/[|\n]/g, ' ').trim()
    lines.push(`|${kind}|${target}|${desc}|`)
  }

  return lines.join('\n')
}

/**
 * Serializes complete subagent payload into pure TOON envelope.
 *
 * @param {object} params
 * @param {string} params.taskId
 * @param {string} params.feature
 * @param {string} params.workspace
 * @param {string} params.role
 * @param {Array<object>} params.tasks
 * @param {string} [params.contracts]
 * @param {Array<object>} [params.relations]
 * @returns {string}
 */
export function serializeSubagentPayloadToTOON({
  taskId = 'TASK-CURRENT',
  feature = 'current-feature',
  workspace = 'workspace',
  role = 'frontend',
  tasks = [],
  contracts = '',
  relations = [],
}) {
  const sections = [
    `::AOI_SUBAGENT_PAYLOAD[v2]::`,
    `META: ws=${workspace} feat=${feature} task=${taskId} role=@${role}`,
    serializeTasksToTOON(tasks),
  ]

  if (contracts && contracts.trim()) {
    sections.push(serializeContractsToTOON(contracts))
  }

  if (relations && relations.length > 0) {
    sections.push(serializeRelationsToTOON(relations))
  }

  sections.push(`::GATES:: TDD=RED->GREEN->REFACTOR | CODE_SAFETY=TRACE_CALLERS | CLI=PREFIX_RTK`)
  sections.push(`::END_PAYLOAD::`)

  return sections.filter(Boolean).join('\n')
}
