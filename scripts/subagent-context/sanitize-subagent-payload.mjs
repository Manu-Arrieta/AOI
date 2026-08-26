#!/usr/bin/env node
/**
 * scripts/subagent-context/sanitize-subagent-payload.mjs
 *
 * Extracts a lightweight, isolated task context payload for subagents
 * (frontend, backend, devops, etc.) from task artifacts, avoiding multi-turn
 * conversational history bloat. Supports both standard Markdown and ultra-dense
 * TOON (Token-Optimized Object Notation) serialization.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { serializeSubagentPayloadToTOON } from './toon-serializer.mjs'

/**
 * Normalizes role names into canonical keys.
 * @param {string} role
 * @returns {string}
 */
export function normalizeRole(role) {
  const normalized = String(role || '').toLowerCase().trim()
  if (normalized.includes('front') || normalized.includes('ui')) return 'frontend'
  if (normalized.includes('back') || normalized.includes('api') || normalized.includes('server')) return 'backend'
  if (normalized.includes('devops') || normalized.includes('infra') || /(?:^|[-_ ])ci(?:$|[-_ ])/.test(normalized)) return 'devops'
  if (normalized.includes('ux') || normalized.includes('design')) return 'ux'
  if (normalized.includes('qa') || normalized.includes('verify') || normalized.includes('integration') || normalized.includes('test')) return 'qa'
  if (normalized.includes('doc')) return 'documentation'
  return normalized || 'general'
}

/**
 * Parses markdown tasks.md and extracts sections/tasks assigned to a specific role.
 *
 * @param {string} tasksMd
 * @param {string} targetRole
 * @returns {Array<{ id: string, title: string, content: string, status: string }>}
 */
export function extractTasksForRole(tasksMd, targetRole) {
  if (!tasksMd || typeof tasksMd !== 'string') return []

  const role = normalizeRole(targetRole)
  const taskBlocks = tasksMd.split(/(?=^###\s+Task\s+|^##\s+Task\s+)/m)
  const extracted = []

  for (const block of taskBlocks) {
    const trimmed = block.trim()
    if (!trimmed.startsWith('#')) continue

    const firstLine = trimmed.split('\n')[0]
    const isAssigned =
      role === 'general' ||
      trimmed.toLowerCase().includes(`[${role}]`) ||
      trimmed.toLowerCase().includes(`@${role}`) ||
      trimmed.toLowerCase().includes(`agent: ${role}`) ||
      firstLine.toLowerCase().includes(role)

    if (isAssigned) {
      const isCompleted = /\[x\]/i.test(firstLine) || /Status:\s*Completed/i.test(trimmed)
      const idMatch = firstLine.match(/Task\s+([A-Za-z0-9-_.]+)/i)
      const id = idMatch ? idMatch[1] : 'unnamed'

      extracted.push({
        id,
        title: firstLine.replace(/^#+\s*/, ''),
        content: trimmed,
        status: isCompleted ? 'completed' : 'pending',
      })
    }
  }

  return extracted
}

/**
 * Extracts key interfaces, contracts, or types from design.md.
 *
 * @param {string} designMd
 * @returns {string}
 */
export function extractContractsFromDesign(designMd) {
  if (!designMd || typeof designMd !== 'string') return ''

  // Look for contract, interface, API, or data model sections
  const contractMatch = designMd.match(
    /(?:##+\s*(?:Contracts?|Interfaces?|API|Data Models?|Component Architecture)[\s\S]*?)(?=\n##+\s+[A-Z]|$)/i
  )

  if (contractMatch) {
    return contractMatch[0].trim()
  }

  // Fallback to first 800 characters of architectural summary if available
  return designMd.slice(0, 800).trim()
}

/**
 * Core pure function to build an isolated subagent payload.
 *
 * @param {object} params
 * @param {string} [params.taskId]
 * @param {string} [params.feature]
 * @param {string} [params.workspace]
 * @param {string} params.role
 * @param {string} [params.tasksMd]
 * @param {string} [params.specMd]
 * @param {string} [params.designMd]
 * @param {string} [params.relationsJson]
 * @param {'markdown'|'toon'} [params.format]
 * @returns {{ role: string, pendingTaskCount: number, payload: string, format: string }}
 */
export function buildSubagentPayload({
  taskId = 'TASK-CURRENT',
  feature = 'current-feature',
  workspace = 'workspace',
  role = 'frontend',
  tasksMd = '',
  specMd = '',
  designMd = '',
  relationsJson = '',
  format = 'markdown',
}) {
  const canonicalRole = normalizeRole(role)
  const matchedTasks = extractTasksForRole(tasksMd, canonicalRole)
  const pendingTasks = matchedTasks.filter((t) => t.status !== 'completed')
  const contracts = extractContractsFromDesign(designMd)

  let parsedRelations = []
  if (relationsJson && relationsJson.trim()) {
    try {
      const parsed = JSON.parse(relationsJson)
      if (parsed.relations && Array.isArray(parsed.relations)) {
        parsedRelations = parsed.relations
      }
    } catch {
      // Ignore malformed relations json in fallback
    }
  }

  if (format === 'toon') {
    const toonPayload = serializeSubagentPayloadToTOON({
      taskId,
      feature,
      workspace,
      role: canonicalRole,
      tasks: pendingTasks,
      contracts,
      relations: parsedRelations,
    })

    return {
      role: canonicalRole,
      pendingTaskCount: pendingTasks.length,
      payload: toonPayload,
      format: 'toon',
    }
  }

  const payloadLines = [
    `=== SUBAGENT ISOLATED CONTEXT ===`,
    `Workspace: ${workspace}`,
    `Feature: ${feature}`,
    `Task ID: ${taskId}`,
    `Assigned Role: @${canonicalRole}`,
    ``,
    `## Assigned Task Breakdown (${pendingTasks.length} Pending)`,
  ]

  if (pendingTasks.length === 0) {
    payloadLines.push(`(No pending tasks explicitly assigned to @${canonicalRole}. Review full tasks.md if needed.)`)
  } else {
    for (const t of pendingTasks) {
      payloadLines.push(``)
      payloadLines.push(`### ${t.title}`)
      payloadLines.push(t.content)
    }
  }

  if (contracts) {
    payloadLines.push(``)
    payloadLines.push(`## Architecture Contracts & Extension Points`)
    payloadLines.push(contracts)
  }

  if (parsedRelations.length > 0) {
    payloadLines.push(``)
    payloadLines.push(`## Linked Resources`)
    for (const rel of parsedRelations) {
      payloadLines.push(`- ${rel.kind}: ${rel.targetPath || rel.path} (${rel.description || 'Context'})`)
    }
  }

  payloadLines.push(``)
  payloadLines.push(`## Mandatory Operational Gates`)
  payloadLines.push(`1. TDD Gate: Follow RED -> GREEN -> REFACTOR per task. No production code without failing test first.`)
  payloadLines.push(`2. Code Safety: Read callers with search_graph/trace_path before modifying existing code.`)
  payloadLines.push(`3. RTK Enforcement: Prefix all terminal commands with 'rtk'.`)
  payloadLines.push(`=================================`)

  return {
    role: canonicalRole,
    pendingTaskCount: pendingTasks.length,
    payload: payloadLines.join('\n'),
    format: 'markdown',
  }
}

/**
 * Loads task files from directory and returns formatted payload.
 *
 * @param {string} taskDir
 * @param {string} role
 * @param {'markdown'|'toon'} [format]
 * @returns {Promise<{ role: string, pendingTaskCount: number, payload: string, format: string }>}
 */
export async function sanitizeTaskPayloadFromDisk(taskDir, role, format = 'markdown') {
  const absDir = path.resolve(taskDir)
  const readFileSafe = (filename) => {
    const filePath = path.join(absDir, filename)
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''
  }

  const tasksMd = readFileSafe('tasks.md')
  const specMd = readFileSafe('spec.md')
  const designMd = readFileSafe('design.md')
  const relationsJson = readFileSafe('relations.json')
  const taskId = path.basename(absDir)
  const feature = path.basename(path.dirname(absDir))

  return buildSubagentPayload({
    taskId,
    feature,
    role,
    tasksMd,
    specMd,
    designMd,
    relationsJson,
    format,
  })
}

// CLI Execution
async function main() {
  const args = process.argv.slice(2)
  let taskDir = '.'
  let role = 'frontend'
  let format = 'markdown'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--task-dir' && args[i + 1]) {
      taskDir = args[++i]
    } else if (args[i] === '--role' && args[i + 1]) {
      role = args[++i]
    } else if (args[i] === '--format' && args[i + 1]) {
      format = args[++i]
    }
  }

  try {
    const result = await sanitizeTaskPayloadFromDisk(taskDir, role, format)
    process.stdout.write(result.payload + '\n')
  } catch (err) {
    process.stderr.write(`Error generating subagent payload: ${err.message}\n`)
    process.exit(1)
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main()
}
