/**
 * scripts/aoi-os/contract-docgen/sequence-diagram-generator.mjs
 *
 * Deterministic Mermaid Sequence Diagram Synthesizer for AOI-OS:
 * Synthesizes visual Mermaid sequence diagrams mapping multi-agent role handoffs,
 * contract signings, and DAG wave execution flows with zero LLM token overhead (0 LLM Tokens).
 */

/**
 * Synthesizes a Mermaid sequence diagram from a list of DAG tasks and waves.
 *
 * @param {object} options
 * @param {string} options.featureTitle - Title of feature
 * @param {Array<object>} options.tasks - List of parsed task nodes
 * @param {Array<Array<object>>} options.waves - Computed execution waves
 * @returns {string} Mermaid sequence diagram string
 */
export function generateSequenceDiagram(options = {}) {
  const title = options.featureTitle || 'AOI SDD Execution Lifecycle'
  const waves = options.waves || []

  const lines = [
    `sequenceDiagram`,
    `    autonumber`,
    `    actor Owner as 👤 Owner / Architect`,
    `    participant Supervisor as 🧭 @supervisor`,
    `    participant Architect as 📐 @architect`,
    `    participant Engine as ⚙️ AOI-OS Kernel`,
    `    participant Backend as 🛠️ @backend`,
    `    participant Frontend as 🎨 @frontend`,
    `    participant DevOps as 🚀 @devops`,
    ``,
    `    %% Phase 1: Intent & Contract Signing`,
    `    Owner->>Supervisor: /sdd-new (Exploration & User Stories)`,
    `    Supervisor->>Architect: /sdd-ff (Fast-Forward Architecture)`,
    `    Architect->>Owner: Present Spec & Contracts for Approval`,
    `    Owner->>Engine: /sdd-apply --os-mode (Signed Contracts)`,
    ``,
  ]

  // Phase 2: Dynamic Execution Waves
  if (waves.length > 0) {
    lines.push(`    %% Phase 2: Parallel Wave Execution`)
    for (let i = 0; i < waves.length; i++) {
      const wave = waves[i]
      lines.push(`    rect rgb(240, 248, 255)`)
      lines.push(`    note over Engine: Wave ${i + 1} (${wave.length} tasks in parallel)`)
      for (const task of wave) {
        const participant =
          task.role === 'frontend'
            ? 'Frontend'
            : task.role === 'devops'
            ? 'DevOps'
            : 'Backend'
        lines.push(`    Engine->>+${participant}: Dispatch ${task.id} (${task.title || 'Task'})`)
        lines.push(`    ${participant}-->>-Engine: Complete ${task.id} (AST & Tests Verified)`)
      }
      lines.push(`    end`, ``)
    }
  }

  // Phase 3: Verification & Memory Archive
  lines.push(
    `    %% Phase 3: Consensus & Memory Sync`,
    `    Engine->>Supervisor: /sdd-verify (Consensus Gate >= 85%)`,
    `    Supervisor->>Owner: Quality Report & Approval Gate`,
    `    Owner->>Engine: /sdd-archive (Synchronize Persistent ICM Memory)`
  )

  return lines.join('\n')
}
