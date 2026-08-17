import test from 'node:test'
import assert from 'node:assert/strict'
import { createAoiOsPipeline } from './aoi-os.mjs'

const SAMPLE_TASKS_MD = `
### Task T-1: Build API route [backend]
- Target: \`server/api/tasks.ts\`
- ## Test Requirements:
  - User logs in with valid email password credentials returning JWT

### Task T-2: Build C# Core Service [backend] (Depends on: T-1)
- Target: \`Services/TaskService.cs\`
`

const SAMPLE_SPEC_MD = `
## User Story 1
As an operator, I want JWT authentication.
### Scenario: User logs in with valid email password credentials returning JWT
`

test('createAoiOsPipeline initializes full v64 pipeline with 232 pillars including HITL subsystem', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v64',
    taskId: 'TASK-2026-64',
    constitutionRules: 'Must use strict typing and no eval',
    globalTokenBudget: 100000,
    federatedPeers: ['MoviHub'],
  })

  assert.equal(pipeline.rawNodes.length, 2)
  assert.equal(pipeline.batches.length, 2)
  assert.ok(pipeline.eventStore.getEventCount() >= 1)

  // 1. Prepare task T-1 with Capability Token
  const prep = pipeline.prepareTaskExecution('T-1')
  assert.equal(prep.node.id, 'T-1')
  assert.equal(prep.microAgent.role, 'backend')
  assert.equal(prep.capabilityToken.signature.length, 64)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'in_progress')

  // 2. User Story Steering Bridge
  const steerResult = pipeline.steerDagWithUserStories({
    globalNotes: ['Always apply strict schema validation'],
    taskDirectives: { 'T-1': ['Use RS256 for signing'] },
  })
  assert.equal(steerResult.steered, true)
  assert.equal(steerResult.steeringProof, 'HUMAN_STORY_STEERING_INJECTED')

  // 3. Human Gate Escalation Guard
  const gateCheck = pipeline.auditHumanGateEscalations({
    taskId: 'T-1',
    blastRadius: 'critical',
    hasExplicitHumanApproval: true,
  })
  assert.equal(gateCheck.canProceed, true)
  assert.equal(gateCheck.gateProof, 'HUMAN_OVERRIDE_APPROVED')

  // 4. Story Acceptance Criteria Alignment Prover
  const storyCheck = pipeline.auditStoryAcceptanceCriteria(SAMPLE_SPEC_MD)
  assert.equal(storyCheck.aligned, true)
  assert.equal(storyCheck.alignmentProof, 'ACCEPTANCE_CRITERIA_100_PERCENT_COVERED')

  // 5. Interactive SDD Interview Prover
  const interviewCheck = pipeline.auditSddInterviews('The endpoint must strictly validate JWT RS256.')
  assert.equal(interviewCheck.valid, true)
  assert.equal(interviewCheck.clarificationProof, 'INTENT_SPECIFICATION_FULLY_DETERMINISTIC')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v64 sovereign 232-pillar master core with HITL governance'],
    diffSummary: 'server/api/tasks.ts (+232 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
