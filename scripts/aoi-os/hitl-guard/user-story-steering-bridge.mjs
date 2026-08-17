/**
 * scripts/aoi-os/hitl-guard/user-story-steering-bridge.mjs
 *
 * Deterministic User Story Steering Feedback Bridge for AOI-OS Human-in-the-Loop:
 * Ingests human feedback, amended acceptance criteria, or natural language steering notes
 * from spec.md user stories and recalibrates in-flight DAG task payloads, dynamically
 * injecting human intent into subsequent micro-agent waves (0 LLM Tokens).
 */

/**
 * Re-weights and steers DAG tasks based on human user story feedback.
 *
 * @param {Array<object>} dagTasks - List of DAG tasks
 * @param {object} steeringFeedback - Human feedback mapped by story or task
 * @param {string[]} [steeringFeedback.globalNotes=[]] - Global directives from user
 * @param {Record<string, string[]>} [steeringFeedback.taskDirectives={}] - Task-specific directives
 * @returns {object} Steered task graph with provenance attestation
 */
export function steerDagWithUserStoryFeedback(dagTasks = [], steeringFeedback = {}) {
  const { globalNotes = [], taskDirectives = {} } = steeringFeedback
  const steeredTasks = []
  let totalSteeredCount = 0

  for (const task of dagTasks) {
    const specificNotes = taskDirectives[task.id] || []
    const combinedNotes = [...globalNotes, ...specificNotes]

    if (combinedNotes.length > 0) {
      steeredTasks.push({
        ...task,
        humanSteeringDirectives: combinedNotes,
        steeredAt: new Date().toISOString(),
      })
      totalSteeredCount++
    } else {
      steeredTasks.push({
        ...task,
        humanSteeringDirectives: [],
      })
    }
  }

  return {
    steered: totalSteeredCount > 0,
    totalTasks: dagTasks.length,
    totalSteeredCount,
    steeredTasks,
    steeringProof: totalSteeredCount > 0 ? 'HUMAN_STORY_STEERING_INJECTED' : 'NO_STEERING_DIRECTIVES_PRESENT',
  }
}
