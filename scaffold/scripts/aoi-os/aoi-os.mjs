#!/usr/bin/env node
/**
 * scripts/aoi-os/aoi-os.mjs
 *
 * Master Orchestrator Engine for AOI-OS v9 (Autonomous, Deterministic & Self-Healing Agentic OS).
 * Unifies DAG Task Compilation, Polyglot AST Contract Guards (TS/Vue/Py/C#),
 * AST Skeletonization & KV-Cache, AST Symbol Mutex, Adversarial Chaos Fuzzing,
 * Dynamic C4 Graph Generation, Time-Travel Snapshots, Mutation Testing,
 * Token Complexity Estimation, OpenAPI 3.1 & E2E Acceptance Flow Synthesizer,
 * Workspace Federation Mesh, Static Taint Tracer, Dead-Code Guard,
 * Dynamic Constitution Drift Auditor, Consensus Gates, and ICM Memory Linking.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { parseTaskDag } from './dag-engine/dag-parser.mjs'
import {
  validateDagStructure,
  computeExecutionBatches,
  createTaskStateManager,
} from './dag-engine/dag-scheduler.mjs'
import { synthesizeMicroAgent } from './subagent-synthesizer/subagent-synthesizer.mjs'
import { validateContractDiff, classifyBlastRadius, detectLanguage } from './ast-guard/ast-contract-guard.mjs'
import { skeletonizeSource } from './ast-guard/ast-skeletonizer.mjs'
import { auditDeadCode } from './ast-guard/ast-deadcode-guard.mjs'
import { createContractKvCache } from './subagent-synthesizer/contract-kv-cache.mjs'
import { createAstSymbolMutex } from './mutex/ast-symbol-mutex.mjs'
import { generateAdversarialVectors } from './fuzzing/adversarial-fuzzer.mjs'
import { generateC4ArchitectureDiagram } from './c4-graph/c4-architecture-generator.mjs'
import { createTimeTravelEngine } from './time-travel/time-travel-engine.mjs'
import { generateAstMutants, calculateMutationScore } from './mutation-testing/ast-mutation-verifier.mjs'
import { traceTaintFlows } from './security-guard/ast-taint-tracer.mjs'
import { estimateTokenComplexity } from './sandbox-runtime/token-complexity-estimator.mjs'
import { synthesizeOpenApiSpec } from './contract-docgen/openapi-synthesizer.mjs'
import { synthesizeE2eTestFlow } from './contract-docgen/e2e-flow-synthesizer.mjs'
import { auditConstitutionDrift } from './consensus-gate/constitution-drift-auditor.mjs'
import { createWorkspaceMeshNode } from './federation/workspace-mesh-bridge.mjs'
import { createSelfHealingSession } from './self-healing/test-healing-loop.mjs'
import { createAoiOsEventBus } from './daemon/workspace-daemon.mjs'
import { createHermeticSandbox } from './sandbox-runtime/sandbox-executor.mjs'
import { createTokenVelocityGuard } from './sandbox-runtime/token-velocity-guard.mjs'
import { evaluateConsensusGate } from './consensus-gate/consensus-arbitrator.mjs'
import { generateTaskMemoryPayload, syncTaskToIcm } from './memory-linker/icm-memory-linker.mjs'

/**
 * Initializes an AOI-OS execution pipeline for a markdown task file.
 *
 * @param {object} options
 * @param {string} options.tasksMarkdown - Raw markdown tasks content
 * @param {string} [options.workspace='AOI'] - Current workspace name
 * @param {string} [options.feature='feature'] - Active feature identifier
 * @param {string} [options.taskId='TASK-CURRENT'] - Task ID
 * @param {string} [options.constitutionRules=''] - Dynamic constitution rules
 * @param {number} [options.globalTokenBudget=200000] - Token budget cap
 * @param {string[]} [options.federatedPeers=[]] - Federated peer workspaces
 * @returns {object} Pipeline instance
 */
export function createAoiOsPipeline(options) {
  const {
    tasksMarkdown,
    workspace = 'AOI',
    feature = 'feature',
    taskId = 'TASK-CURRENT',
    constitutionRules = '',
    globalTokenBudget = 200000,
    federatedPeers = [],
  } = options

  const eventBus = createAoiOsEventBus()
  const tokenGovernor = createTokenVelocityGuard({ globalTokenBudget })
  const symbolMutex = createAstSymbolMutex()
  const contractCache = createContractKvCache()
  const timeTravel = createTimeTravelEngine()
  const meshNode = createWorkspaceMeshNode({ workspaceId: workspace, peers: federatedPeers })

  const rawNodes = parseTaskDag(tasksMarkdown)
  const validation = validateDagStructure(rawNodes)

  if (!validation.valid) {
    eventBus.emit('dag_transition', `Invalid DAG structure: ${validation.errors.join('; ')}`, { errors: validation.errors }, 'error')
    throw new Error(`DAG Validation Failed: ${validation.errors.join('; ')}`)
  }

  const stateManager = createTaskStateManager(rawNodes)
  const batches = computeExecutionBatches(rawNodes)

  // Capture initial snapshot
  timeTravel.captureSnapshot(0, {
    totalNodes: rawNodes.length,
    batchesCount: batches.length,
    initialAt: new Date().toISOString(),
  })

  eventBus.emit(
    'dag_transition',
    `DAG Pipeline initialized with ${rawNodes.length} nodes across ${batches.length} waves.`,
    { nodeCount: rawNodes.length, waveCount: batches.length },
    'info'
  )

  /**
   * Prepares a task node for execution by synthesizing its micro-agent.
   *
   * @param {string} nodeId
   */
  function prepareTaskExecution(nodeId) {
    const node = stateManager.getTask(nodeId)
    if (!node) throw new Error(`Task [${nodeId}] not found in DAG.`)

    const microAgent = synthesizeMicroAgent({
      dagNode: node,
      workspace,
      feature,
      taskId,
      constitutionRules,
    })

    stateManager.transition(nodeId, 'in_progress', { agentId: microAgent.agentId })
    eventBus.emit(
      'dag_transition',
      `Task [${nodeId}] dispatched to @${microAgent.role} (${microAgent.agentId})`,
      { taskId: nodeId, role: microAgent.role },
      'info'
    )

    return { node, microAgent }
  }

  /**
   * Evaluates predictive complexity and token requirements for a file.
   *
   * @param {string} sourceCode
   * @param {string} [filePath]
   */
  function predictComplexity(sourceCode, filePath = 'file.ts') {
    return estimateTokenComplexity(sourceCode, filePath)
  }

  /**
   * Generates AST micro-mutations to verify test suite quality.
   *
   * @param {string} sourceCode
   * @param {object} [options]
   */
  function performMutationAnalysis(sourceCode, options = {}) {
    return generateAstMutants(sourceCode, options)
  }

  /**
   * Performs static taint and data-flow security analysis.
   *
   * @param {string} sourceCode
   * @param {string} [filePath]
   */
  function auditTaintSecurity(sourceCode, filePath = 'file.ts') {
    return traceTaintFlows(sourceCode, filePath)
  }

  /**
   * Identifies dead code and orphan variables.
   *
   * @param {string} sourceCode
   * @param {string} [filePath]
   */
  function auditDeadCodeHygiene(sourceCode, filePath = 'file.ts') {
    return auditDeadCode(sourceCode, filePath)
  }

  /**
   * Audits code against dynamic architectural constitution.
   *
   * @param {string} sourceCode
   * @param {string} [filePath]
   */
  function auditConstitution(sourceCode, filePath = 'file.ts') {
    return auditConstitutionDrift(sourceCode, filePath)
  }

  /**
   * Synthesizes OpenAPI 3.1 specification for all current DAG tasks.
   *
   * @param {object} [options]
   */
  function getOpenApiSpecification(options = {}) {
    return synthesizeOpenApiSpec(rawNodes, options)
  }

  /**
   * Synthesizes executable E2E acceptance test suite.
   *
   * @param {object} [options]
   */
  function generateE2eAcceptanceSuite(options = {}) {
    return synthesizeE2eTestFlow(rawNodes, options)
  }

  /**
   * Prunes source code into a skeletonized slice to maximize token savings.
   *
   * @param {string} sourceCode
   * @param {string} filePath
   * @param {string[]} [targetSymbols=[]]
   */
  function getPrunedSourceSlice(sourceCode, filePath, targetSymbols = []) {
    return skeletonizeSource(sourceCode, filePath, { targetSymbols })
  }

  /**
   * Generates dynamic C4 architecture diagram.
   */
  function getC4ArchitectureDiagram(systemName) {
    const currentTasks = rawNodes.map((n) => ({
      ...n,
      status: stateManager.getTask(n.id)?.status || 'pending',
    }))
    return generateC4ArchitectureDiagram(currentTasks, { systemName })
  }

  /**
   * Runs adversarial chaos fuzzing against target function signatures.
   *
   * @param {Array<{ name: string, type?: string }>} params
   * @param {string} functionName
   */
  function runChaosFuzzing(params, functionName) {
    const fuzzResults = generateAdversarialVectors(params, { functionName })
    eventBus.emit(
      'chaos_fuzzer',
      `Chaos Fuzzer synthesized ${fuzzResults.testCasesCount} boundary vectors for [${functionName}]`,
      { functionName, count: fuzzResults.testCasesCount },
      'info'
    )
    return fuzzResults
  }

  /**
   * Creates a hermetic ephemeral sandbox for safe execution of a task.
   *
   * @param {string} nodeId
   * @param {string[]} [filesToMount=[]]
   */
  function createTaskSandbox(nodeId, filesToMount = []) {
    const node = stateManager.getTask(nodeId)
    if (!node) throw new Error(`Task [${nodeId}] not found in DAG.`)

    const sandbox = createHermeticSandbox({
      taskId: nodeId,
      filesToMount: filesToMount.length ? filesToMount : node.targetFiles || [],
    })

    eventBus.emit(
      'sandbox_mounted',
      `Hermetic sandbox staged at .sandboxes/aoi-os-tmp-${nodeId}`,
      { taskId: nodeId, filesCount: filesToMount.length },
      'info'
    )

    return sandbox
  }

  /**
   * Verifies code modifications against the Polyglot AST Contract Guard.
   *
   * @param {string} filePath
   * @param {string} originalCode
   * @param {string} proposedCode
   */
  function verifyCodeChange(filePath, originalCode, proposedCode) {
    const check = validateContractDiff(originalCode, proposedCode, filePath)
    const blastRadius = classifyBlastRadius(check.violations.length)
    const language = detectLanguage(filePath)

    if (!check.safe) {
      eventBus.emit(
        'ast_guard',
        `Contract violation in ${filePath} (${language}): ${check.violations.join('; ')}`,
        { filePath, language, violations: check.violations, blastRadius },
        'error'
      )
    } else {
      eventBus.emit(
        'ast_guard',
        `Contract invariant preserved in ${filePath} (${language})`,
        { filePath, language, blastRadius },
        'success'
      )
    }

    return { ...check, blastRadius, language }
  }

  /**
   * Evaluates code proposal through the Multi-Agent Consensus & Arbitration Gate.
   *
   * @param {string} nodeId
   * @param {string} code
   * @param {object} [options]
   */
  function evaluateConsensus(nodeId, code, options = {}) {
    const node = stateManager.getTask(nodeId)
    const filePath = options.filePath || node?.targetFiles?.[0] || 'file.ts'

    const evalResult = evaluateConsensusGate({
      code,
      filePath,
      testsPassed: options.testsPassed ?? true,
      astInvariantSafe: options.astInvariantSafe ?? true,
    })

    if (evalResult.approved) {
      eventBus.emit(
        'consensus_gate',
        `Consensus Gate APPROVED task [${nodeId}] with score ${evalResult.score}%`,
        { taskId: nodeId, score: evalResult.score },
        'success'
      )
    } else {
      eventBus.emit(
        'consensus_gate',
        `Consensus Gate REJECTED task [${nodeId}] (score: ${evalResult.score}%): ${evalResult.feedback.join('; ')}`,
        { taskId: nodeId, score: evalResult.score, feedback: evalResult.feedback },
        'warning'
      )
    }

    return evalResult
  }

  /**
   * Finalizes task and automatically extracts & links semantic memories to ICM.
   *
   * @param {string} nodeId
   * @param {object} [options]
   * @param {Function} [execFn]
   */
  async function finalizeTaskMemory(nodeId, options = {}, execFn = null) {
    const node = stateManager.getTask(nodeId)
    if (!node) throw new Error(`Task [${nodeId}] not found.`)

    const payload = generateTaskMemoryPayload({
      workspace,
      feature,
      taskId: nodeId,
      taskTitle: node.title,
      role: node.role,
      decisions: options.decisions || [],
      resolvedErrors: options.resolvedErrors || [],
      diffSummary: options.diffSummary || '',
      dependsOn: node.dependsOn,
    })

    const syncResult = await syncTaskToIcm(payload, execFn)

    eventBus.emit(
      'memory_synced',
      `Semantic Memory Graph updated: ${payload.memories.length} memories staged for task [${nodeId}]`,
      { taskId: nodeId, count: payload.memories.length },
      'info'
    )

    stateManager.transition(nodeId, 'completed')
    return { payload, syncResult }
  }

  /**
   * Initiates a self-healing session for a failing task.
   *
   * @param {string} nodeId
   * @param {string} [targetFile='']
   * @param {number} [maxRetries=2]
   */
  function startHealingSession(nodeId, targetFile = '', maxRetries = 2) {
    const node = stateManager.getTask(nodeId)
    if (!node) throw new Error(`Task [${nodeId}] not found.`)

    stateManager.transition(nodeId, 'healing')
    const session = createSelfHealingSession({
      taskId: nodeId,
      role: node.role,
      targetFile,
      maxRetries,
    })

    eventBus.emit(
      'self_healing',
      `Self-healing session started for task [${nodeId}]`,
      { taskId: nodeId, maxRetries },
      'warning'
    )

    return session
  }

  return {
    rawNodes,
    batches,
    stateManager,
    eventBus,
    tokenGovernor,
    symbolMutex,
    contractCache,
    timeTravel,
    meshNode,
    prepareTaskExecution,
    predictComplexity,
    performMutationAnalysis,
    auditTaintSecurity,
    auditDeadCodeHygiene,
    auditConstitution,
    getOpenApiSpecification,
    generateE2eAcceptanceSuite,
    getPrunedSourceSlice,
    getC4ArchitectureDiagram,
    runChaosFuzzing,
    createTaskSandbox,
    verifyCodeChange,
    evaluateConsensus,
    finalizeTaskMemory,
    startHealingSession,
  }
}

// CLI entry point
async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    process.stdout.write('Usage: node scripts/aoi-os/aoi-os.mjs <path-to-tasks.md>\n')
    process.exit(0)
  }

  const resolved = path.resolve(process.cwd(), filePath)
  if (!fs.existsSync(resolved)) {
    process.stderr.write(`File not found: ${resolved}\n`)
    process.exit(1)
  }

  const markdown = fs.readFileSync(resolved, 'utf8')
  const pipeline = createAoiOsPipeline({ tasksMarkdown: markdown })

  process.stdout.write(`✅ AOI-OS v9: Successfully compiled DAG from ${filePath}\n`)
  process.stdout.write(`   Nodes: ${pipeline.rawNodes.length} | Waves: ${pipeline.batches.length}\n`)
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main()
}
