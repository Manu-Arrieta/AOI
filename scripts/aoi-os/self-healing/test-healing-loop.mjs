/**
 * scripts/aoi-os/self-healing/test-healing-loop.mjs
 *
 * Autonomous Self-Healing Loop & Circuit Breaker:
 * Extracts surgical test failure diagnostics, formulates minimal repair prompts,
 * and trips the circuit breaker to auto-rollback when repair attempts exceed the budget.
 */

/**
 * Extracts a clean failure diagnostic from test runner output (Vitest, Node test, Jest).
 *
 * @param {string} rawOutput
 * @returns {{ testName: string, errorMessage: string, stackSnippet: string, failed: boolean }}
 */
export function extractFailureDiagnostic(rawOutput) {
  if (!rawOutput || typeof rawOutput !== 'string') {
    return { testName: '', errorMessage: '', stackSnippet: '', failed: false }
  }

  const isFailed =
    rawOutput.includes('FAIL') ||
    rawOutput.includes('failing tests') ||
    rawOutput.includes('AssertionError') ||
    rawOutput.includes('ERR_ASSERTION') ||
    rawOutput.includes('Error:')

  if (!isFailed) {
    return { testName: '', errorMessage: '', stackSnippet: '', failed: false }
  }

  // Extract failing test name
  let testName = 'unknown-test'
  const testMatch =
    rawOutput.match(/✖\s+([^\n(]+)/) ||
    rawOutput.match(/FAIL\s+([^\n]+)/) ||
    rawOutput.match(/it\('([^']+)'/)
  if (testMatch) {
    testName = testMatch[1].trim()
  }

  // Extract error message
  let errorMessage = 'Test failed assertion'
  const errMatch =
    rawOutput.match(/(?:AssertionError|Error):\s*([^\n]+)/i) ||
    rawOutput.match(/Expected[^\n]+/i)
  if (errMatch) {
    errorMessage = errMatch[0].trim()
  }

  // Extract stack trace snippet (max 4 lines)
  const stackLines = rawOutput
    .split('\n')
    .filter((line) => line.trim().startsWith('at ') || line.includes('AssertionError'))
    .slice(0, 4)
    .join('\n')

  return {
    testName,
    errorMessage,
    stackSnippet: stackLines || rawOutput.slice(0, 300).trim(),
    failed: true,
  }
}

/**
 * Creates a self-healing session with bounded retries and circuit-breaker.
 *
 * @param {object} params
 * @param {string} params.taskId
 * @param {string} params.role
 * @param {string} [params.targetFile='']
 * @param {number} [params.maxRetries=2]
 */
export function createSelfHealingSession({
  taskId,
  role,
  targetFile = '',
  maxRetries = 2,
}) {
  let attemptCount = 0
  let state = 'active' // 'active' | 'tripped' | 'resolved'
  const failureHistory = []

  function recordFailure(rawOutput, diffSnippet = '') {
    attemptCount++
    const diagnostic = extractFailureDiagnostic(rawOutput)
    failureHistory.push({ attempt: attemptCount, diagnostic, timestamp: new Date().toISOString() })

    if (attemptCount >= maxRetries) {
      state = 'tripped'
    }

    const fixPromptLines = [
      `=== SELF-HEALING FIX DIRECTIVE (Attempt ${attemptCount}/${maxRetries}) ===`,
      `Task: ${taskId} | Assigned: @${role}`,
      `Target File: ${targetFile || 'recently modified file'}`,
      ``,
      `## Failing Diagnostic`,
      `Test: ${diagnostic.testName}`,
      `Error: ${diagnostic.errorMessage}`,
      ``,
      `## Stack Trace`,
      diagnostic.stackSnippet,
    ]

    if (diffSnippet && diffSnippet.trim()) {
      fixPromptLines.push(``)
      fixPromptLines.push(`## Recent Diff Slice`)
      fixPromptLines.push(diffSnippet.trim())
    }

    fixPromptLines.push(``)
    fixPromptLines.push(`## Mandatory Rule:`)
    fixPromptLines.push(`Fix ONLY the failing assertion. Do NOT refactor surrounding logic or change public signatures.`)
    fixPromptLines.push(`=======================================================`)

    return {
      attemptCount,
      isCircuitBreakerTripped: state === 'tripped',
      fixPrompt: fixPromptLines.join('\n'),
      diagnostic,
    }
  }

  function resolveSuccess() {
    state = 'resolved'
    return {
      resolved: true,
      attemptsUsed: attemptCount,
    }
  }

  async function executeCircuitBreakerRollback(rollbackHandler) {
    if (state !== 'tripped') {
      throw new Error(`Circuit breaker is not tripped (current state: ${state}).`)
    }

    let rollbackResult = null
    if (typeof rollbackHandler === 'function') {
      rollbackResult = await rollbackHandler()
    }

    const escalationReport = [
      `# 🚨 CIRCUIT BREAKER TRIPPED — Task [${taskId}]`,
      `The self-healing loop reached its maximum retry limit (${maxRetries} attempts) without achieving GREEN tests.`,
      ``,
      `## Root Cause Diagnostics`,
      ...failureHistory.map(
        (f) => `- Attempt ${f.attempt}: [${f.diagnostic.testName}] -> ${f.diagnostic.errorMessage}`
      ),
      ``,
      `## Action Taken:`,
      `- Workspace state restored to previous clean snapshot.`,
      `- Task status flagged as [BLOCKED_ESCALATION].`,
      `- Operator review required before re-attempting.`,
    ].join('\n')

    return {
      tripped: true,
      rollbackResult,
      escalationReport,
    }
  }

  return {
    taskId,
    role,
    getState: () => state,
    getAttempts: () => attemptCount,
    recordFailure,
    resolveSuccess,
    executeCircuitBreakerRollback,
  }
}
