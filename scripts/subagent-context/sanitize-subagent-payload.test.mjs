import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeRole,
  extractTasksForRole,
  extractContractsFromDesign,
  buildSubagentPayload,
} from './sanitize-subagent-payload.mjs'

test('normalizeRole maps common variants to canonical names', () => {
  assert.equal(normalizeRole('frontend-developer'), 'frontend')
  assert.equal(normalizeRole('UI-Dev'), 'frontend')
  assert.equal(normalizeRole('backend-engineer'), 'backend')
  assert.equal(normalizeRole('devops'), 'devops')
  assert.equal(normalizeRole('ux-designer'), 'ux')
  assert.equal(normalizeRole('integration-specialist'), 'qa')
  assert.equal(normalizeRole('documentation-analyst'), 'documentation')
})

test('extractTasksForRole filters tasks by role assignment and status', () => {
  const sampleTasks = `
# Tasks Breakdown

### Task T-1: Setup Pinia Store [frontend]
- Setup store
- Status: Completed [x]

### Task T-2: Build TaskBoard Component [frontend]
- Build UI
- Status: Pending

### Task T-3: Implement Server Endpoint [backend]
- Write Nitro API route
- Status: Pending
`

  const frontendTasks = extractTasksForRole(sampleTasks, 'frontend')
  assert.equal(frontendTasks.length, 2)
  assert.equal(frontendTasks[0].id, 'T-1')
  assert.equal(frontendTasks[0].status, 'completed')
  assert.equal(frontendTasks[1].id, 'T-2')
  assert.equal(frontendTasks[1].status, 'pending')

  const backendTasks = extractTasksForRole(sampleTasks, 'backend')
  assert.equal(backendTasks.length, 1)
  assert.equal(backendTasks[0].id, 'T-3')
  assert.equal(backendTasks[0].status, 'pending')
})

test('extractContractsFromDesign extracts interface and contract blocks', () => {
  const designSample = `
# Architecture Design

## Overview
High level system overview.

## Interfaces & Contracts
\`\`\`ts
export interface TaskPayload {
  id: string
  title: string
}
\`\`\`

## Deployment
Docker details.
`

  const contracts = extractContractsFromDesign(designSample)
  assert.ok(contracts.includes('export interface TaskPayload'))
  assert.ok(!contracts.includes('Docker details'))
})

test('buildSubagentPayload constructs a clean isolated prompt payload', () => {
  const tasksMd = `
### Task T-1: Build UI Component [frontend]
- Write Vue component
- ## Test Requirements (TDD):
  - Unit test with Vitest
`
  const designMd = `
## Interfaces
\`\`\`ts
export type Status = 'active' | 'archived'
\`\`\`
`
  const relationsJson = JSON.stringify({
    relations: [{ kind: 'userstory', targetPath: '.resources/userstories/US-01.md', description: 'Auth story' }],
  })

  const result = buildSubagentPayload({
    taskId: 'TASK-2026-001',
    feature: 'token-optimization',
    workspace: 'AOI',
    role: 'frontend',
    tasksMd,
    designMd,
    relationsJson,
  })

  assert.equal(result.role, 'frontend')
  assert.equal(result.pendingTaskCount, 1)
  assert.ok(result.payload.includes('=== SUBAGENT ISOLATED CONTEXT ==='))
  assert.ok(result.payload.includes('Task ID: TASK-2026-001'))
  assert.ok(result.payload.includes('Assigned Role: @frontend'))
  assert.ok(result.payload.includes('Task T-1: Build UI Component'))
  assert.ok(result.payload.includes('export type Status'))
  assert.ok(result.payload.includes('.resources/userstories/US-01.md'))
  assert.ok(result.payload.includes('TDD Gate'))
})
