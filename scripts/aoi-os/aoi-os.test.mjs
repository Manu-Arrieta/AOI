import test from 'node:test'
import assert from 'node:assert/strict'
import { createAoiOsPipeline } from './aoi-os.mjs'

const SAMPLE_TASKS_MD = `
### Task T-1: Build API route [backend]
- Target: \`server/api/tasks.ts\`
- ## Test Requirements:
  - Return 200 OK

### Task T-2: Build C# Core Service [backend] (Depends on: T-1)
- Target: \`Services/TaskService.cs\`
`

test('createAoiOsPipeline initializes full v31 pipeline with 100 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v31',
    taskId: 'TASK-2026-31',
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

  // 2. WebSocket Heartbeat Guard
  const wsCheck = pipeline.auditWebSocketHeartbeats("wss.on('connection', (ws) => { const t = setInterval(() => ws.ping(), 1000); ws.on('close', () => clearInterval(t)); });")
  assert.equal(wsCheck.safe, true)
  assert.equal(wsCheck.heartbeatProof, 'WEBSOCKET_HEARTBEAT_TEARDOWN_PROVEN')

  // 3. Dead Type Alias Pruner
  const aliasCheck = pipeline.auditDeadTypeAliasHierarchy(['UserSummary'], 'function render(u: UserSummary) {}')
  assert.equal(aliasCheck.allReferenced, true)
  assert.equal(aliasCheck.aliasProof, 'ALL_TYPE_ALIASES_REFERENCED')

  // 4. Content-Type & Payload Serialization Guard
  const payloadCheck = pipeline.auditPayloadDeserialization("export default defineEventHandler(async (e) => { const b = await readValidatedBody(e, (x) => schema.safeParse(x)); });")
  assert.equal(payloadCheck.safe, true)
  assert.equal(payloadCheck.payloadProof, 'PAYLOAD_DESERIALIZATION_SAFE_AND_VALIDATED')

  // 5. Sandbox Socket Unbind Prover
  const socketCheck = pipeline.auditSocketUnbind("const s = http.createServer(); s.listen(3000); afterAll(() => s.close());")
  assert.equal(socketCheck.safe, true)
  assert.equal(socketCheck.socketProof, 'NETWORK_SOCKET_UNBIND_GUARANTEED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v31 centurial 100-pillar omnipresent singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+80 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
