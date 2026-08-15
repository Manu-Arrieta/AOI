/**
 * scripts/aoi-os/subagent-synthesizer/subagent-synthesizer.mjs
 *
 * Synthesizes just-in-time, disposable micro-agents with micro-scoped prompts
 * (<300 tokens system overhead), whitelisted tools, and strict file boundaries.
 */

import { normalizeRole } from '../../subagent-context/sanitize-subagent-payload.mjs'

/**
 * Resolves allowed tool capabilities for a given role.
 *
 * @param {string} role
 * @returns {string[]}
 */
export function resolveToolCapabilityWhitelist(role) {
  const normalized = normalizeRole(role)

  switch (normalized) {
    case 'frontend':
    case 'backend':
    case 'devops':
      return ['replace_file_content', 'write_to_file', 'run_command', 'get_errors', 'view_file']
    case 'qa':
      return ['run_command', 'view_file', 'grep_search']
    case 'ux':
      return ['write_to_file', 'replace_file_content', 'view_file']
    default:
      return ['view_file', 'run_command']
  }
}

/**
 * Synthesizes an ephemeral micro-agent invocation payload for a single DAG node.
 *
 * @param {object} params
 * @param {import('../dag-engine/dag-parser.mjs').DagNode} params.dagNode
 * @param {string} [params.workspace='workspace']
 * @param {string} [params.feature='feature']
 * @param {string} [params.taskId='TASK-CURRENT']
 * @param {string} [params.constitutionRules='']
 * @returns {{ agentId: string, role: string, systemPrompt: string, taskPrompt: string, allowedTools: string[], tokenBudget: number }}
 */
export function synthesizeMicroAgent({
  dagNode,
  workspace = 'workspace',
  feature = 'feature',
  taskId = 'TASK-CURRENT',
  constitutionRules = '',
}) {
  const role = normalizeRole(dagNode.role)
  const agentId = `micro-${role}-${dagNode.id.toLowerCase()}`
  const allowedTools = resolveToolCapabilityWhitelist(role)

  const systemLines = [
    `ROLE: @${role}-micro-worker`,
    `SCOPE: Execute task [${dagNode.id}] in workspace [${workspace}].`,
    `PERMISSIONS: Only modify declared target files: ${dagNode.targetFiles.join(', ') || 'as specified in task'}.`,
    `TDD INVARIANT: Follow RED -> GREEN -> REFACTOR. No untested code.`,
    `RTK ENFORCEMENT: Prefix terminal commands with 'rtk'.`,
  ]

  if (constitutionRules && constitutionRules.trim()) {
    systemLines.push(`STANDARDS: ${constitutionRules.trim()}`)
  }

  const taskLines = [
    `=== MICRO-AGENT ASSIGNMENT ===`,
    `Feature: ${feature} | Task: ${taskId} / Node: ${dagNode.id}`,
    `Title: ${dagNode.title}`,
    ``,
    `## Action Directives`,
    dagNode.metadata?.rawBlock || dagNode.title,
  ]

  if (dagNode.testRequirements) {
    taskLines.push(``)
    taskLines.push(`## Test Criteria (TDD)`)
    taskLines.push(dagNode.testRequirements)
  }

  taskLines.push(``)
  taskLines.push(`==============================`)

  return {
    agentId,
    role,
    systemPrompt: systemLines.join('\n'),
    taskPrompt: taskLines.join('\n'),
    allowedTools,
    tokenBudget: 2500, // Strict token ceiling for micro-turns
  }
}
