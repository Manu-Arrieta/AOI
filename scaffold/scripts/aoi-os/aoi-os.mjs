#!/usr/bin/env node
/**
 * scripts/aoi-os/aoi-os.mjs
 *
 * Master Orchestrator Engine for AOI-OS v20 (The Grand Epistemic Singularity & Omnipresent Master Matrix).
 * Unifies DAG Task Compilation, Polyglot AST Contract Guards (TS/Vue/Py/C#),
 * AST Skeletonization & KV-Cache, AST Symbol Mutex, Adversarial Chaos Fuzzing,
 * Dynamic C4 Graph Generation, Time-Travel Snapshots, Mutation Testing,
 * Token Complexity Estimation, OpenAPI 3.1 & E2E Acceptance Flow Synthesizer,
 * Workspace Federation Mesh, Static Taint Tracer, Dead-Code Guard,
 * Dynamic Constitution Drift Auditor, Live Micro-Patch Kernel, Symbolic Constraint Prover,
 * Test Flakiness Detector, Bidirectional ABI Linker, AST Content-Addressable Memo Engine,
 * Adaptive Wave Worker Balancer, BFT Multi-Verifier Cognitive Quorum,
 * Polyglot Contract Transpiler & DTO Mirror, Branchless State Virtualizer,
 * C2 Flight Recorder, Semantic Ontology & Knowledge Fabric, Zero-Cost AST Inliner,
 * Quantum Super-Position Synthesis Matrix, Polyglot Deep Type Synthesizer,
 * Semantic Token Hologram, Zero-Trust Syscall Virtual Guard, Polyglot Dependency Solver,
 * Deterministic Event-Sourcing Kernel, Zero-Overhead Micro-Benchmark Suite,
 * Axiom Self-Reconciler, Self-Refactoring AST Kernel, Database Migration Diff Synthesizer,
 * Schema Convergence Prover, Micro-Prompt Context Compactor, Zero-Knowledge Epistemic Attestor,
 * Root Cause Diagnostic Synthesizer, Circular Dependency Neutralizer,
 * Token Liquidity Balancer, Knowledge Mesh Reconciler, ABI Wave Broadcaster,
 * Prefix Deduplication Engine, Resource Exhaustion Prover, Epistemic Game Engine,
 * Monorepo Dead-Asset Pruner, Speculative Wave Pipeline, Deterministic SBOM Generator,
 * Epistemic Entropy Prover, Delta Snapshot Compressor, API Route Collision Matrix,
 * Capability Token Enforcer, Epistemic Bias Neutralizer, Nullability Contract Guard,
 * Cognitive Density Maximizer, Sandbox Descriptor Sanitizer, and ICM Memory Linking.
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
import { balanceWaveTasks } from './dag-engine/adaptive-wave-balancer.mjs'
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
import { auditSyscallSecurity } from './security-guard/syscall-virtual-guard.mjs'
import { estimateTokenComplexity } from './sandbox-runtime/token-complexity-estimator.mjs'
import { synthesizeOpenApiSpec } from './contract-docgen/openapi-synthesizer.mjs'
import { synthesizeE2eTestFlow } from './contract-docgen/e2e-flow-synthesizer.mjs'
import { auditConstitutionDrift } from './consensus-gate/constitution-drift-auditor.mjs'
import { evaluateBftQuorum } from './consensus-gate/bft-quorum-engine.mjs'
import { createWorkspaceMeshNode } from './federation/workspace-mesh-bridge.mjs'
import { createLivePatchKernel } from './runtime-kernel/live-patch-kernel.mjs'
import { proveSymbolicConstraints } from './symbolic-prover/symbolic-constraint-prover.mjs'
import { auditTestFlakiness } from './test-guard/flakiness-detector.mjs'
import { alignBidirectionalAbi } from './abi-linker/bidirectional-abi-linker.mjs'
import { createAstMemoEngine } from './memo-engine/ast-memo-engine.mjs'
import {
  transpileToCSharp,
  transpileToPython,
  transpileToSql,
} from './contract-transpiler/polyglot-transpiler.mjs'
import { virtualizeControlFlow } from './virtualizer/branchless-virtualizer.mjs'
import { createFlightRecorder } from './telemetry/flight-recorder.mjs'
import { createSemanticFabric } from './ontology/semantic-fabric.mjs'
import { optimizeAstRepresentation } from './ast-optimizer/ast-inliner.mjs'
import { evaluateSuperpositionBranches } from './quantum-synthesis/superposition-matrix.mjs'
import { synthesizeFunctionTypesAndSchema } from './type-synthesizer/deep-type-synthesizer.mjs'
import { createTokenHologram } from './hologram/token-hologram.mjs'
import { solveDependencies } from './dependency-solver/polyglot-dependency-solver.mjs'
import { createEventSourcingKernel } from './event-sourcing/event-sourcing-kernel.mjs'
import { runMicroBenchmark } from './benchmark/micro-benchmark-suite.mjs'
import { reconcileAxioms } from './axiom-reconciler/axiom-reconciler.mjs'
import { proposeAstRefactoring } from './ast-refactor/self-refactoring-kernel.mjs'
import { synthesizeMigrationDiff } from './db-migration/migration-diff-synthesizer.mjs'
import { proveSchemaConvergence } from './convergence/schema-convergence-prover.mjs'
import { compactContextPayload } from './context-compactor/micro-prompt-compactor.mjs'
import { generateEpistemicAttestation } from './zk-attestor/zk-epistemic-attestor.mjs'
import { diagnoseRootCause } from './diagnostics/root-cause-synthesizer.mjs'
import { neutralizeCircularDependencies } from './circular-neutralizer/circular-dependency-neutralizer.mjs'
import { balanceTokenLiquidity } from './liquidity-balancer/token-liquidity-balancer.mjs'
import { reconcileKnowledgeMesh } from './knowledge-mesh/knowledge-mesh-reconciler.mjs'
import { broadcastAbiWave } from './abi-broadcaster/abi-wave-broadcaster.mjs'
import { optimizePromptCache } from './cache-optimizer/prefix-deduplication-engine.mjs'
import { proveResourceContainment } from './sandbox-guard/resource-exhaustion-prover.mjs'
import { calculateNashEquilibrium } from './game-engine/epistemic-game-engine.mjs'
import { auditDeadAssets } from './asset-pruner/monorepo-dead-asset-pruner.mjs'
import { createSpeculativePipeline } from './speculative/speculative-wave-pipeline.mjs'
import { generateDeterministicSbom } from './sbom/deterministic-sbom-generator.mjs'
import { calculateShannonEntropy, proveEpistemicEntropy } from './entropy-prover/epistemic-entropy-prover.mjs'
import { compressDelta, applyDelta } from './delta-compressor/delta-snapshot-compressor.mjs'
import { auditRouteCollisions } from './route-guard/api-collision-matrix.mjs'
import { createCapabilityToken, enforceCapability } from './capability-guard/capability-enforcer.mjs'
import { neutralizeEpistemicBias } from './bias-neutralizer/epistemic-bias-neutralizer.mjs'
import { auditNullabilitySafety } from './nullability-guard/nullability-contract-guard.mjs'
import { maximizeCognitiveDensity } from './density-maximizer/cognitive-density-maximizer.mjs'
import { sanitizeSandboxDescriptors } from './sandbox-guard/descriptor-sanitizer.mjs'
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
  const patchKernel = createLivePatchKernel()
  const memoEngine = createAstMemoEngine()
  const flightRecorder = createFlightRecorder({ serviceName: `aoi-os-${workspace}` })
  const semanticFabric = createSemanticFabric()
  const tokenHologram = createTokenHologram([constitutionRules, tasksMarkdown])
  const eventStore = createEventSourcingKernel({ streamId: `aoi-os-${workspace}-${taskId}` })
  const speculativePipeline = createSpeculativePipeline()

  const rawNodes = parseTaskDag(tasksMarkdown)
  const validation = validateDagStructure(rawNodes)

  if (!validation.valid) {
    eventBus.emit('dag_transition', `Invalid DAG structure: ${validation.errors.join('; ')}`, { errors: validation.errors }, 'error')
    throw new Error(`DAG Validation Failed: ${validation.errors.join('; ')}`)
  }

  const stateManager = createTaskStateManager(rawNodes)
  const batches = computeExecutionBatches(rawNodes)

  // Record initialization event in append-only store
  eventStore.appendEvent('PIPELINE_INITIALIZED', {
    workspace,
    feature,
    taskId,
    totalNodes: rawNodes.length,
    totalWaves: batches.length,
  })

  // Register DAG tasks in semantic ontology
  for (const node of rawNodes) {
    semanticFabric.addNode(`task:${node.id}`, 'task', node.title, { role: node.role })
    if (node.dependsOn?.length) {
      for (const dep of node.dependsOn) {
        semanticFabric.addEdge(`task:${node.id}`, `task:${dep}`, 'depends_on')
      }
    }
  }

  // Pre-stage future wave speculatively if more than 1 wave exists
  if (batches.length > 1) {
    const wave2Tasks = batches[1].map((id) => stateManager.getTask(id)).filter(Boolean)
    speculativePipeline.stageSpeculativeWave(1, wave2Tasks)
  }

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

    const capabilityToken = createCapabilityToken({
      taskId: nodeId,
      role: microAgent.role,
      allowedFiles: node.targetFiles || [],
    })

    stateManager.transition(nodeId, 'in_progress', { agentId: microAgent.agentId })
    eventStore.appendEvent('TASK_DISPATCHED', { taskId: nodeId, agentId: microAgent.agentId, role: microAgent.role })

    eventBus.emit(
      'dag_transition',
      `Task [${nodeId}] dispatched to @${microAgent.role} (${microAgent.agentId})`,
      { taskId: nodeId, role: microAgent.role },
      'info'
    )

    return { node, microAgent, capabilityToken }
  }

  /**
   * Neutralizes subjective biases in text rationales.
   *
   * @param {string} text
   */
  function cleanseEpistemicBias(text) {
    return neutralizeEpistemicBias(text)
  }

  /**
   * Audits cross-boundary optional/nullable property dereferencing.
   *
   * @param {string} sourceCode
   * @param {string[]} optionalFields
   */
  function auditNullability(sourceCode, optionalFields = []) {
    return auditNullabilitySafety(sourceCode, optionalFields)
  }

  /**
   * Compresses natural language directives to symbolic notations (>95% SNR).
   *
   * @param {string} directives
   */
  function maximizeDensity(directives) {
    return maximizeCognitiveDensity(directives)
  }

  /**
   * Proves 100% clean teardown of ephemeral descriptors in sandbox.
   *
   * @param {string[]} remainingFiles
   */
  function auditDescriptorSanitization(remainingFiles = []) {
    return sanitizeSandboxDescriptors(remainingFiles)
  }

  /**
   * Evaluates epistemic Shannon entropy between iterations.
   *
   * @param {string} prevCode
   * @param {string} currCode
   */
  function auditEntropy(prevCode, currCode) {
    return proveEpistemicEntropy(prevCode, currCode)
  }

  /**
   * Compresses snapshot delta between states.
   *
   * @param {Record<string, any>} baseState
   * @param {Record<string, any>} nextState
   */
  function compressStateDelta(baseState, nextState) {
    return compressDelta(baseState, nextState)
  }

  /**
   * Audits monorepo API routes for method and parameter collisions.
   *
   * @param {Array<{ method: string, path: string }>} routes
   */
  function auditApiCollisions(routes = []) {
    return auditRouteCollisions(routes)
  }

  /**
   * Enforces capability token against attempted action.
   *
   * @param {object} token
   * @param {object} action
   */
  function verifyCapability(token, action) {
    return enforceCapability(token, action)
  }

  /**
   * Calculates Nash Equilibrium consensus across micro-agents.
   *
   * @param {object} evalOptions
   */
  function evaluateGameConsensus(evalOptions) {
    return calculateNashEquilibrium(evalOptions)
  }

  /**
   * Audits declared assets against source files to detect dead zombie resources.
   *
   * @param {string[]} assets
   * @param {string[]} sources
   */
  function auditZombieAssets(assets = [], sources = []) {
    return auditDeadAssets(assets, sources)
  }

  /**
   * Generates a standardized CycloneDX SBOM for supply-chain integrity.
   *
   * @param {Array<{ name: string, version?: string, type?: string, content?: string }>} components
   */
  function generateSbomReport(components = []) {
    return generateDeterministicSbom({
      projectName: `AOI-${workspace}`,
      version: '20.0.0',
      components,
    })
  }

  /**
   * Reconciles ICM memory graph with active rules to detect obsolete decisions.
   *
   * @param {Array<{ id: string, topic: string, content: string }>} memories
   * @param {string[]} activeRules
   */
  function auditKnowledgeDrift(memories = [], activeRules = []) {
    return reconcileKnowledgeMesh({ memories, activeRules })
  }

  /**
   * Calculates transitive ABI propagation waves across dependent packages.
   *
   * @param {string} changedContract
   * @param {Record<string, string[]>} dependents
   */
  function broadcastAbiUpdates(changedContract, dependents = {}) {
    return broadcastAbiWave(changedContract, dependents)
  }

  /**
   * Optimizes prompt payloads for 100% KV-cache reuse across micro-agent invocations.
   *
   * @param {object} cachePayload
   */
  function optimizeCachePrefix(cachePayload) {
    return optimizePromptCache(cachePayload)
  }

  /**
   * Proves hermetic resource containment and zero handle leaks in sandbox code.
   *
   * @param {string} sourceCode
   */
  function auditResourceLeaks(sourceCode) {
    return proveResourceContainment(sourceCode)
  }

  /**
   * Generates a zero-knowledge cryptographic epistemic attestation for task assertions.
   *
   * @param {string} taskIdentifier
   * @param {Array<{ assertion: string, passed: boolean }>} assertions
   */
  function attestTaskCompliance(taskIdentifier, assertions = []) {
    return generateEpistemicAttestation(taskIdentifier, assertions)
  }

  /**
   * Classifies error messages and traces into formal root-cause archetypes.
   *
   * @param {string} errorMessage
   * @param {string} [stackTrace]
   */
  function diagnoseError(errorMessage, stackTrace = '') {
    return diagnoseRootCause(errorMessage, stackTrace)
  }

  /**
   * Detects circular dependencies and synthesizes decoupling plans.
   *
   * @param {Record<string, string[]>} dependencyGraph
   */
  function auditCircularDependencies(dependencyGraph) {
    return neutralizeCircularDependencies(dependencyGraph)
  }

  /**
   * Rebalances token budget liquidity across active parallel tasks.
   *
   * @param {number} totalPool
   * @param {Array<{ taskId: string, role?: string, complexity?: string }>} tasks
   */
  function rebalanceLiquidity(totalPool, tasks) {
    return balanceTokenLiquidity(totalPool, tasks)
  }

  /**
   * Analyzes complex monolithic functions and generates refactoring proposals.
   *
   * @param {string} sourceCode
   * @param {object} [options]
   */
  function proposeRefactor(sourceCode, options = {}) {
    return proposeAstRefactoring(sourceCode, options)
  }

  /**
   * Generates zero-downtime reversible database migration scripts.
   *
   * @param {string} tableName
   * @param {Record<string, string>} prevCols
   * @param {Record<string, string>} currCols
   */
  function generateDbMigration(tableName, prevCols, currCols) {
    return synthesizeMigrationDiff(tableName, prevCols, currCols)
  }

  /**
   * Proves full schema convergence across polyglot representations.
   *
   * @param {string} sourceSchema
   * @param {string} targetSchema
   */
  function proveConvergence(sourceSchema, targetSchema) {
    return proveSchemaConvergence(sourceSchema, targetSchema)
  }

  /**
   * Compacts raw context payloads into high-density micro-prompts.
   *
   * @param {string} rawPayload
   */
  function compactPrompt(rawPayload) {
    return compactContextPayload(rawPayload)
  }

  /**
   * Audits dependency imports against package manifests.
   *
   * @param {object} [packageJson]
   * @param {string[]} [sourceImports]
   */
  function auditDependencies(packageJson = {}, sourceImports = []) {
    return solveDependencies({ packageJson, sourceImports })
  }

  /**
   * Runs local performance micro-benchmarks on critical functions.
   *
   * @param {string} name
   * @param {Function} fn
   * @param {object} [benchmarkOptions]
   */
  function benchmarkFunction(name, fn, benchmarkOptions = {}) {
    return runMicroBenchmark(name, fn, benchmarkOptions)
  }

  /**
   * Reconciles workspace axioms with task artifacts.
   *
   * @param {string[]} [axioms]
   * @param {Array<{ taskId: string, code?: string }>} [taskArtifacts]
   */
  function auditAxiomEquilibrium(axioms = [], taskArtifacts = []) {
    return reconcileAxioms({ axioms, taskArtifacts })
  }

  /**
   * Evaluates speculative code branches and collapses to the optimal candidate.
   *
   * @param {Array<{ id: string, name: string, code: string }>} candidateBranches
   */
  function synthesizeSuperposition(candidateBranches) {
    return evaluateSuperpositionBranches(candidateBranches)
  }

  /**
   * Infers TypeScript signatures and Zod schemas from loosely typed functions.
   *
   * @param {string} fnDeclaration
   */
  function synthesizeTypesAndSchema(fnDeclaration) {
    return synthesizeFunctionTypesAndSchema(fnDeclaration)
  }

  /**
   * Audits generated code for dangerous syscall patterns and sandbox escapes.
   *
   * @param {string} sourceCode
   */
  function auditSyscalls(sourceCode) {
    return auditSyscallSecurity(sourceCode)
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
   * Proves mathematical and boundary invariants symbolically.
   *
   * @param {string} sourceCode
   * @param {string} [functionName]
   */
  function proveInvariants(sourceCode, functionName = '') {
    return proveSymbolicConstraints(sourceCode, functionName)
  }

  /**
   * Virtualizes control flow and proves lock/resource safety.
   *
   * @param {string} sourceCode
   */
  function virtualizeControl(sourceCode) {
    return virtualizeControlFlow(sourceCode)
  }

  /**
   * Evaluates and applies zero-cost AST optimizations.
   *
   * @param {string} sourceCode
   */
  function optimizeAst(sourceCode) {
    return optimizeAstRepresentation(sourceCode)
  }

  /**
   * Audits test suite for flakiness, race conditions, and unseeded randomness.
   *
   * @param {string} testCode
   * @param {string} [filePath]
   */
  function auditFlakiness(testCode, filePath = 'test.ts') {
    return auditTestFlakiness(testCode, filePath)
  }

  /**
   * Aligns client and server ABI type definitions in real time.
   *
   * @param {string} clientType
   * @param {string} serverType
   */
  function alignAbi(clientType, serverType) {
    return alignBidirectionalAbi(clientType, serverType)
  }

  /**
   * Evaluates code proposal across 5 deterministic verifiers in BFT Quorum.
   *
   * @param {object} evalOptions
   */
  function evaluateBftQuorumVerdict(evalOptions) {
    return evaluateBftQuorum(evalOptions)
  }

  /**
   * Transpiles a TypeScript interface definition to C#, Python, and SQL DDL.
   *
   * @param {string} tsInterfaceCode
   */
  function transpileInterfacePolyglot(tsInterfaceCode) {
    return {
      csharp: transpileToCSharp(tsInterfaceCode),
      python: transpileToPython(tsInterfaceCode),
      sql: transpileToSql(tsInterfaceCode),
    }
  }

  /**
   * Balances a wave's parallel tasks across worker slots using bin-packing.
   *
   * @param {number} waveIndex
   * @param {number} [workerCount=3]
   */
  function balanceWave(waveIndex = 0, workerCount = 3) {
    const waveTaskIds = batches[waveIndex] || []
    const waveTasks = waveTaskIds.map((id) => stateManager.getTask(id)).filter(Boolean)
    return balanceWaveTasks(waveTasks, workerCount)
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

    eventStore.appendEvent('MEMORY_SYNCED', { taskId: nodeId, memoryCount: payload.memories.length })

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
    eventStore,
    speculativePipeline,
    tokenGovernor,
    symbolMutex,
    contractCache,
    timeTravel,
    meshNode,
    patchKernel,
    memoEngine,
    flightRecorder,
    semanticFabric,
    tokenHologram,
    prepareTaskExecution,
    cleanseEpistemicBias,
    auditNullability,
    maximizeDensity,
    auditDescriptorSanitization,
    auditEntropy,
    compressStateDelta,
    auditApiCollisions,
    verifyCapability,
    evaluateGameConsensus,
    auditZombieAssets,
    generateSbomReport,
    auditKnowledgeDrift,
    broadcastAbiUpdates,
    optimizeCachePrefix,
    auditResourceLeaks,
    attestTaskCompliance,
    diagnoseError,
    auditCircularDependencies,
    rebalanceLiquidity,
    proposeRefactor,
    generateDbMigration,
    proveConvergence,
    compactPrompt,
    auditDependencies,
    benchmarkFunction,
    auditAxiomEquilibrium,
    synthesizeSuperposition,
    synthesizeTypesAndSchema,
    auditSyscalls,
    predictComplexity,
    performMutationAnalysis,
    proveInvariants,
    virtualizeControl,
    optimizeAst,
    auditFlakiness,
    alignAbi,
    evaluateBftQuorumVerdict,
    transpileInterfacePolyglot,
    balanceWave,
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

  process.stdout.write(`✅ AOI-OS v20: Successfully compiled DAG from ${filePath}\n`)
  process.stdout.write(`   Nodes: ${pipeline.rawNodes.length} | Waves: ${pipeline.batches.length}\n`)
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main()
}
