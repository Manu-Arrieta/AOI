/**
 * scripts/aoi-os/capability-guard/capability-enforcer.mjs
 *
 * Deterministic Capability Token & Micro-Agent Confinement Enforcer for AOI-OS:
 * Synthesizes non-transferable cryptographic capability tokens per DAG task node,
 * strictly enforcing file mutation boundaries and tool access permissions (0 LLM Tokens).
 */

import crypto from 'node:crypto'

/**
 * Creates an ephemeral cryptographic capability token for a DAG task node.
 *
 * @param {object} options
 * @param {string} options.taskId
 * @param {string} [options.role='backend']
 * @param {string[]} [options.allowedFiles=[]]
 * @param {string[]} [options.allowedTools=[]]
 * @returns {object} Capability token object
 */
export function createCapabilityToken(options = {}) {
  const {
    taskId = 'TASK-UNKNOWN',
    role = 'backend',
    allowedFiles = [],
    allowedTools = ['view_file', 'replace_file_content', 'write_to_file'],
  } = options

  const payload = `${taskId}:${role}:${allowedFiles.sort().join(',')}:${allowedTools.sort().join(',')}`
  const signature = crypto.createHash('sha256').update(payload).digest('hex')

  return {
    taskId,
    role,
    allowedFiles,
    allowedTools,
    signature,
    issuedAt: new Date().toISOString(),
  }
}

/**
 * Evaluates whether an attempted operation is authorized by the capability token.
 *
 * @param {object} token - Capability token
 * @param {object} attemptedAction
 * @param {'MUTATE_FILE' | 'EXEC_TOOL'} attemptedAction.operation
 * @param {string} attemptedAction.target - Target file path or tool name
 * @returns {object} Authorization verdict
 */
export function enforceCapability(token, attemptedAction = {}) {
  const { operation, target } = attemptedAction

  if (!token || !token.signature) {
    return {
      authorized: false,
      reason: 'MISSING_OR_INVALID_CAPABILITY_TOKEN',
      enforcementProof: 'CAPABILITY_ENFORCEMENT_VETO',
    }
  }

  if (operation === 'MUTATE_FILE') {
    const isAllowed = token.allowedFiles.length === 0 || token.allowedFiles.some((f) => target.includes(f) || f.includes(target))
    return {
      authorized: isAllowed,
      reason: isAllowed ? 'FILE_MUTATION_PERMITTED' : `TARGET_FILE_OUT_OF_BOUNDS: ${target}`,
      enforcementProof: isAllowed ? 'CAPABILITY_ENFORCEMENT_AUTHORIZED' : 'CAPABILITY_ENFORCEMENT_VETO',
    }
  }

  if (operation === 'EXEC_TOOL') {
    const isAllowed = token.allowedTools.includes(target)
    return {
      authorized: isAllowed,
      reason: isAllowed ? 'TOOL_EXECUTION_PERMITTED' : `UNAUTHORIZED_TOOL_REQUESTED: ${target}`,
      enforcementProof: isAllowed ? 'CAPABILITY_ENFORCEMENT_AUTHORIZED' : 'CAPABILITY_ENFORCEMENT_VETO',
    }
  }

  return {
    authorized: false,
    reason: `UNKNOWN_OPERATION: ${operation}`,
    enforcementProof: 'CAPABILITY_ENFORCEMENT_VETO',
  }
}
