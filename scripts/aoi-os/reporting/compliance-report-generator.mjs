/**
 * scripts/aoi-os/reporting/compliance-report-generator.mjs
 *
 * Deterministic Compliance and Security Audit Report Generator for AOI-OS:
 * Consolidates results across Storage, Security, Config, AST, and Sandbox provers
 * into auditable JSON, Markdown, and summary formats with zero LLM token overhead (0 LLM Tokens).
 */

/**
 * Generates an aggregated compliance audit report.
 *
 * @param {object} options
 * @param {string} options.workspace - Workspace name
 * @param {string} options.taskId - Task or feature identifier
 * @param {Array<object>} options.auditResults - Array of individual audit outcomes
 * @returns {object} Aggregated compliance report
 */
export function generateComplianceReport(options = {}) {
  const workspace = options.workspace || 'AOI'
  const taskId = options.taskId || 'TASK-AUDIT'
  const results = options.auditResults || []

  let totalAudits = 0
  let passedAudits = 0
  let failedAudits = 0
  const findings = []

  for (const item of results) {
    totalAudits++
    const isPassing = item.safe === true || item.clean === true || item.valid === true
    if (isPassing) {
      passedAudits++
    } else {
      failedAudits++
      findings.push({
        pillar: item.pillar || 'Unspecified Pillar',
        proof: item.proof || item.structuralProof || item.atomicFsyncProof || 'UNKNOWN_PROOF',
        violations: item.violations || item.reasons || item.errors || [],
        severity: item.severity || 'HIGH',
      })
    }
  }

  const complianceScorePercentage = totalAudits > 0
    ? Math.round((passedAudits / totalAudits) * 10000) / 100
    : 100

  const status = failedAudits === 0 ? 'COMPLIANT' : 'VIOLATIONS_DETECTED'

  /**
   * Formats report as GitHub-flavored Markdown.
   *
   * @returns {string} Markdown text
   */
  function toMarkdown() {
    const lines = [
      `# AOI-OS Security & Architectural Compliance Report`,
      ``,
      `- **Workspace**: \`${workspace}\``,
      `- **Task/Scope**: \`${taskId}\``,
      `- **Overall Status**: **${status}**`,
      `- **Compliance Score**: \`${complianceScorePercentage}%\``,
      `- **Passed**: ${passedAudits} / ${totalAudits}`,
      `- **Failed**: ${failedAudits}`,
      ``,
    ]

    if (findings.length === 0) {
      lines.push(`> [!NOTE]\n> All evaluated architectural, cryptographic, and sandbox invariants passed without violations.`)
    } else {
      lines.push(`## ⚠️ Findings & Remediation Required`, ``)
      for (const finding of findings) {
        lines.push(`### 🔴 [${finding.severity}] ${finding.pillar}`)
        lines.push(`- **Proof Failure**: \`${finding.proof}\``)
        if (finding.violations.length > 0) {
          lines.push(`- **Violations**:`)
          for (const v of finding.violations) {
            lines.push(`  - ${v}`)
          }
        }
        lines.push(``)
      }
    }

    return lines.join('\n')
  }

  return {
    workspace,
    taskId,
    status,
    totalAudits,
    passedAudits,
    failedAudits,
    complianceScorePercentage,
    findings,
    toMarkdown,
  }
}
