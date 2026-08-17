#!/usr/bin/env node
/**
 * scripts/aoi-os/aoi-os.mjs
 *
 * Master Orchestrator Engine for AOI-OS v58 (The Transcendent 208-Pillar Omnipresent Singularity & Universal Autonomous Genesis Core).
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
 * Cognitive Density Maximizer, Sandbox Descriptor Sanitizer, Epistemic Provenance Chain,
 * Package Export Leak Prover, Dynamic Budget Auto-Throttle, Side-Channel Timing Leak Guard,
 * Semantic AST Merge Prover, Query Performance & N+1 Guard, Bundle Size & Tree-Shaking Verifier,
 * Sandbox Zombie PID Purger, Mutation Test Invariant Prover, HTTP Payload Drift Guard,
 * Barrel Star-Export Neutralizer, Sandbox File Permission & Mask Prover, Promise Cascade Guard,
 * API Schema Sunset Sentinel, Heap Allocation & LOH Prover, Sandbox Network Egress Interceptor,
 * Peer Dependency Convergence Guard, ReDoS Vulnerability Prover, CSS Token Drift Guard,
 * Sandbox Handle Leak Prover, Environment Variable & Secret Leak Prover, Structural Config Guard,
 * Dead Route Pruner, Sandbox Signal Teardown Prover, Lockfile Divergence Prover,
 * HTTP Header & CORS Guard, Dead Vue Component Pruner, Sandbox Pipe Cleanup Prover,
 * SSE & WebSocket Stream Teardown Prover, Dead Type & Interface Pruner, SQL Injection Guard,
 * Sandbox Path Escape Prover, Cache Invalidation Guard, Dead Enum & Constant Pruner,
 * Path Traversal Guard, Sandbox Subprocess Drain Prover, Rate Limiting & DoS Defense Guard,
 * Dead Export Package Entrypoint Pruner, SSR Hydration Mismatch Guard, Sandbox Temp Directory Cleanup Prover,
 * WebSocket Ping/Pong Heartbeat Teardown Guard, Dead Type Alias & Generic Parameter Pruner,
 * Content-Type & Payload Serialization Guard, Sandbox Network Socket Unbind Prover,
 * Database Connection Pool Drain Prover, Dead i18n & Localization Key Pruner,
 * JWT & Auth Token Expiration Guard, Sandbox Symlink Traversal Escape Prover,
 * OpenTelemetry Tracer Span Lifecycle Guard, Dead Environment Variable & Config Flag Pruner,
 * Query Depth & Algorithmic Complexity Guard, Sandbox Shared Memory & IPC Channel Cleanup Prover,
 * Web Worker & Worker Thread Termination Guard, Dead Store State & Pinia Property Pruner,
 * SSE & WebSocket Stream Backpressure Guard, Sandbox Privilege Escalation & Setuid Prover,
 * Browser Storage Quota & Expiration Guard, Dead Custom CSS Class & Utility Pruner,
 * Test Network Port Collision & Ephemeral Binding Prover, Sandbox File Descriptor Concurrency & Ulimit Prover,
 * Database Transaction Rollback & Commit Lifecycle Guard, Dead Package Script & npm Run Pruner,
 * Safe HTML & DOM Sanitization Guard, Sandbox Process Environment Variable Isolation Prover,
 * Outbound HTTP Request Timeout & AbortSignal Guard, Dead Markdown Anchor & Cross-Doc Link Pruner,
 * Dynamic RegExp Length & ReDoS Timeout Guard, Sandbox Process Core Dump Prevention Prover,
 * Sensitive Data & PII Masking Guard, Dead Gitignore Pattern Pruner,
 * Safe Cryptographic Algorithm Guard, Sandbox Process Resource Limit (RLimit CPU & AS) Prover,
 * Unhandled Rejection & Process Exception Guard, Dead Monorepo Workspace Package Pruner,
 * Safe Cryptographic Randomness (CSPRNG) Guard, Sandbox Process File Descriptor Isolation Prover,
 * Atomic File Replace & Staged Write Guard, Dead Config Path Alias Pruner,
 * Safe Regular Expression Unicode Flag Guard, Sandbox Process Scheduling Priority & Niceness Prover,
 * Atomic File Lock & PID Lease Guard, Dead Barrel Duplicate Re-Export Pruner,
 * Safe Shell Command Argument Quoting Guard, Sandbox Process Group Signal Trap Prover,
 * Atomic File Permissions & umask Guard, Dead Workspace Protocol Dependency Pruner,
 * Safe Cryptographic KDF (PBKDF2/Scrypt) Guard, Sandbox Child Process MaxBuffer Overflow Prover,
 * Atomic Temporary File Collision & Cryptographic Prefix Guard, Dead Lifecycle Script Hook Pruner,
 * Safe Cryptographic Cipher Mode & GCM Auth Tag Guard, Sandbox Child Process IPC Message Bounds Prover,
 * Atomic Directory Traversal Boundary & Canonical Realpath Guard, Dead Package Export Condition Pruner,
 * Safe Cryptographic Timing-Safe Buffer Comparison Guard, Sandbox Worker AbortController Cancellation Prover,
 * Atomic Hardlink Recursion & Inode Loop Guard, Dead Package Binary Entrypoint Pruner,
 * Safe Cryptographic Elliptic Curve Hardness Guard, Sandbox Dynamic Import Subresource Integrity (SRI) Prover,
 * Atomic Stream Chunk UTF-8 Boundary Guard, Dead TypeScript Project Reference Pruner,
 * Safe Cryptographic TLS Minimum Protocol Version Guard, Sandbox Child Process Stdio Buffer Flush Prover,
 * Atomic Temporary Symlink Clashing & Race Guard, Dead Workspace TypeScript Include Path Pruner,
 * Safe Cryptographic PBKDF2 Digest Algorithm Hardness Guard, Sandbox Child Process Stdin Stream Closure Prover,
 * Atomic Buffer Slicing & Subarray Bounds Guard, Dead TypeScript Compiler Options types Pruner,
 * Safe Cryptographic RSA Key Minimum Modulus Length Guard, Sandbox Dynamic Worker MessagePort Transfer Prover,
 * Atomic Stream & EventEmitter MaxListeners Leak Guard, Dead TypeScript Path Mapping Prefix Pruner,
 * Safe Cryptographic Diffie-Hellman Group & Prime Length Guard, Sandbox Child Process IPC Channel Disconnect Prover,
 * Atomic Stream highWaterMark Memory Bounding Guard, Dead TypeScript Exclude Pattern Pruner,
 * Safe Cryptographic HKDF Parameter & Digest Guard, Sandbox Child Process Unref & Detach Prover,
 * Atomic Stream Pipe & Pipeline Auto-Destroy Guard, Dead TypeScript Compiler Options lib Pruner,
 * Safe Cryptographic Scrypt Cost & Parameter Guard, Sandbox Process PATH Variable Sanitization Prover,
 * Atomic Stream Transform _final & _flush Cleanup Guard, Dead TypeScript JSX Configuration Pruner,
 * Safe Cryptographic ChaCha20-Poly1305 Nonce & Auth Guard, Sandbox Child Process NODE_OPTIONS Sanitization Prover,
 * Atomic Stream cork & uncork Memory Flush Guard, Dead TypeScript BaseUrl Configuration Pruner,
 * Safe Cryptographic ECDH Curve Hardness Guard, Sandbox Dynamic Linker Preload Sanitization Prover,
 * Atomic Stream pause & resume Flow Control Guard, Dead TypeScript Interop Flag Pruner,
 * Safe Cryptographic EdDSA Signature & Algorithm Guard, Sandbox Worker Resource Limits & Heap Cap Prover,
 * Atomic Stream pipeline & finished Async Await Guard, Dead TypeScript Redundant Strict Sub-Flags Pruner,
 * Safe Cryptographic Key Pair Generation Guard, Sandbox Worker TransferList & Zero-Copy Prover,
 * Atomic Stream Duplex & Half-Close Socket Guard, Dead TypeScript Target-Lib Consistency Pruner,
 * Safe Cryptographic RSA-PSS Padding & Salt Guard, Sandbox Process windowsHide Isolation Prover,
 * Atomic Stream objectMode & HighWaterMark Scale Guard, Dead TypeScript resolveJsonModule Pruner,
 * Safe Cryptographic Decipher AuthTag Order Guard, Sandbox Process IPC Serialization Prover,
 * Atomic File Append Sequential Lock Guard, Dead TypeScript Root Types Leakage Pruner,
 * Safe Cryptographic X.509 Certificate Guard, Sandbox Process Detached Teardown Prover,
 * and ICM Memory Linking.
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
import { auditTimingSafety } from './security-guard/timing-leak-guard.mjs'
import { proveRedosSafety } from './security-guard/redos-vulnerability-prover.mjs'
import { auditHttpHeadersAndCors } from './security-guard/http-header-guard.mjs'
import { auditSqlSecurity } from './security-guard/sql-injection-guard.mjs'
import { auditPathTraversalSafety } from './security-guard/path-traversal-guard.mjs'
import { auditRateLimiting } from './security-guard/rate-limit-guard.mjs'
import { auditPayloadDeserializationSafety } from './security-guard/content-type-guard.mjs'
import { auditJwtExpirationSafety } from './security-guard/jwt-expiration-guard.mjs'
import { auditQueryDepthSafety } from './security-guard/query-depth-guard.mjs'
import { auditHtmlSanitizationSafety } from './security-guard/html-sanitization-guard.mjs'
import { auditDynamicRegexSafety } from './security-guard/regex-timeout-guard.mjs'
import { auditCryptoAlgorithmSafety } from './security-guard/crypto-algorithm-guard.mjs'
import { auditCryptoRandomSafety } from './security-guard/crypto-random-guard.mjs'
import { auditRegexUnicodeSafety } from './security-guard/regex-flag-guard.mjs'
import { auditShellQuoteSafety } from './security-guard/shell-quote-guard.mjs'
import { auditCryptoKdfSafety } from './security-guard/crypto-kdf-guard.mjs'
import { auditCryptoCipherModeSafety } from './security-guard/crypto-cipher-mode-guard.mjs'
import { auditCryptoTimingSafeBufferSafety } from './security-guard/crypto-timing-safe-buffer-guard.mjs'
import { auditCryptoEcCurveSafety } from './security-guard/crypto-ec-curve-guard.mjs'
import { auditCryptoTlsVersionSafety } from './security-guard/crypto-tls-version-guard.mjs'
import { auditCryptoPbkdf2DigestSafety } from './security-guard/crypto-pbkdf2-digest-guard.mjs'
import { auditCryptoRsaKeyLengthSafety } from './security-guard/crypto-rsa-key-length-guard.mjs'
import { auditCryptoDhGroupSafety } from './security-guard/crypto-dh-group-guard.mjs'
import { auditCryptoHkdfParamSafety } from './security-guard/crypto-hkdf-param-guard.mjs'
import { auditCryptoScryptParamSafety } from './security-guard/crypto-scrypt-param-guard.mjs'
import { auditCryptoChachaNonceSafety } from './security-guard/crypto-chacha-nonce-guard.mjs'
import { auditCryptoEcdhCurveSafety } from './security-guard/crypto-ecdh-curve-guard.mjs'
import { auditCryptoEddsaVerifySafety } from './security-guard/crypto-eddsa-verify-guard.mjs'
import { auditCryptoKeyPairSafety } from './security-guard/crypto-key-pair-curve-guard.mjs'
import { auditCryptoRsaPssPaddingSafety } from './security-guard/crypto-rsa-pss-padding-guard.mjs'
import { auditCryptoDecipherAuthTagSafety } from './security-guard/crypto-decipher-authtag-guard.mjs'
import { auditCryptoX509CertSafety } from './security-guard/crypto-x509-cert-guard.mjs'
import { auditCacheInvalidation } from './cache-guard/cache-invalidation-guard.mjs'
import { auditEnvAndSecrets } from './env-guard/env-secret-prover.mjs'
import { auditDeadEnvFlags } from './env-guard/dead-env-pruner.mjs'
import { validateStructuralConfig } from './config-guard/structural-config-guard.mjs'
import { auditDeadConfigAliases } from './config-guard/dead-alias-pruner.mjs'
import { auditDeadTsconfigReferences } from './config-guard/dead-tsconfig-reference-pruner.mjs'
import { auditDeadTsconfigIncludes } from './config-guard/dead-tsconfig-include-pruner.mjs'
import { auditDeadTsconfigTypes } from './config-guard/dead-tsconfig-types-pruner.mjs'
import { auditDeadTsconfigPathPrefixes } from './config-guard/dead-tsconfig-path-prefix-pruner.mjs'
import { auditDeadTsconfigExcludes } from './config-guard/dead-tsconfig-exclude-pruner.mjs'
import { auditDeadTsconfigLibs } from './config-guard/dead-tsconfig-lib-pruner.mjs'
import { auditDeadTsconfigJsx } from './config-guard/dead-tsconfig-jsx-pruner.mjs'
import { auditDeadTsconfigBaseUrl } from './config-guard/dead-tsconfig-baseurl-pruner.mjs'
import { auditDeadTsconfigInterop } from './config-guard/dead-tsconfig-interop-pruner.mjs'
import { auditDeadTsconfigStrictFlags } from './config-guard/dead-tsconfig-strict-flag-pruner.mjs'
import { auditDeadTsconfigTargetLib } from './config-guard/dead-tsconfig-target-lib-pruner.mjs'
import { auditDeadTsconfigJsonModule } from './config-guard/dead-tsconfig-json-module-pruner.mjs'
import { auditDeadTsconfigRootTypes } from './config-guard/dead-tsconfig-root-types-pruner.mjs'
import { auditDeadRoutes } from './route-guard/dead-route-pruner.mjs'
import { auditDeadMarkdownDocLinks } from './doc-guard/dead-doc-link-pruner.mjs'
import { auditDeadGitignoreRules } from './repo-guard/dead-gitignore-pruner.mjs'
import { auditDeadComponents } from './component-guard/dead-component-pruner.mjs'
import { auditDeadStoreState } from './component-guard/dead-store-pruner.mjs'
import { auditHydrationSafety } from './component-guard/hydration-mismatch-guard.mjs'
import { auditDeadTypes } from './type-guard/dead-type-pruner.mjs'
import { auditDeadTypeAliases } from './type-guard/dead-type-alias-pruner.mjs'
import { auditDeadEnums } from './enum-guard/dead-enum-pruner.mjs'
import { auditDeadPackageExports } from './export-guard/dead-export-package-pruner.mjs'
import { auditDeadPackageScripts } from './package-guard/dead-script-pruner.mjs'
import { auditDeadWorkspacePackages } from './package-guard/dead-workspace-package-pruner.mjs'
import { auditDeadWorkspaceProtocols } from './package-guard/dead-workspace-protocol-pruner.mjs'
import { auditDeadScriptHooks } from './package-guard/dead-script-hook-pruner.mjs'
import { auditDeadPackageExportConditions } from './package-guard/dead-package-export-condition-pruner.mjs'
import { auditDeadPackageBinaries } from './package-guard/dead-package-bin-pruner.mjs'
import { auditDeadBarrelDuplicates } from './export-guard/dead-barrel-duplicate-pruner.mjs'
import { auditDeadI18nKeys } from './i18n-guard/dead-i18n-pruner.mjs'
import { proveDbPoolDrainSafety } from './db-guard/db-pool-drain-prover.mjs'
import { auditTransactionRollbackSafety } from './db-guard/transaction-rollback-guard.mjs'
import { proveStreamTeardownSafety } from './stream-guard/stream-teardown-prover.mjs'
import { auditStreamBackpressureSafety } from './stream-guard/stream-backpressure-guard.mjs'
import { auditWebSocketHeartbeat } from './stream-guard/websocket-heartbeat-guard.mjs'
import { auditHttpRequestTimeoutSafety } from './stream-guard/http-timeout-guard.mjs'
import { auditStreamMaxListenersSafety } from './storage-guard/stream-max-listeners-guard.mjs'
import { auditStreamHighWaterMarkSafety } from './storage-guard/stream-highwatermark-guard.mjs'
import { auditStreamPipeDestroySafety } from './storage-guard/stream-pipe-destroy-guard.mjs'
import { auditStreamTransformFinalSafety } from './storage-guard/stream-transform-final-guard.mjs'
import { auditStreamCorkUncorkSafety } from './storage-guard/stream-cork-uncork-guard.mjs'
import { auditStreamPauseResumeSafety } from './storage-guard/stream-pause-resume-guard.mjs'
import { auditStreamPipelineAsyncSafety } from './storage-guard/stream-pipeline-async-guard.mjs'
import { auditStreamHalfCloseSafety } from './storage-guard/stream-half-close-guard.mjs'
import { auditStreamObjectModeHighWaterMarkSafety } from './storage-guard/stream-objectmode-highwatermark-guard.mjs'
import { auditFileAppendLockSafety } from './storage-guard/file-append-lock-guard.mjs'
import { proveSignalTeardown } from './sandbox-guard/signal-teardown-prover.mjs'
import { provePipeCleanupSafety } from './sandbox-guard/pipe-cleanup-prover.mjs'
import { provePathContainment } from './sandbox-guard/sandbox-path-escape-prover.mjs'
import { proveSymlinkContainment } from './sandbox-guard/sandbox-symlink-escape-prover.mjs'
import { provePrivilegeEscalationSafety } from './sandbox-guard/sandbox-privilege-escalation-prover.mjs'
import { proveSandboxUlimitSafety } from './sandbox-guard/sandbox-ulimit-prover.mjs'
import { proveSandboxEnvIsolationSafety } from './sandbox-guard/sandbox-env-isolation-prover.mjs'
import { proveSandboxCoreDumpSafety } from './sandbox-guard/sandbox-coredump-prover.mjs'
import { proveSandboxRLimitSafety } from './sandbox-guard/sandbox-rlimit-prover.mjs'
import { proveSandboxFdIsolationSafety } from './sandbox-guard/sandbox-fd-cloexec-prover.mjs'
import { proveSandboxPrioritySafety } from './sandbox-guard/sandbox-priority-prover.mjs'
import { proveSandboxSignalTrapSafety } from './sandbox-guard/sandbox-signal-trap-prover.mjs'
import { proveSandboxMaxBufferSafety } from './sandbox-guard/sandbox-maxbuffer-prover.mjs'
import { proveSandboxIpcPayloadSafety } from './sandbox-guard/sandbox-ipc-payload-prover.mjs'
import { proveSandboxAbortControllerSafety } from './sandbox-guard/sandbox-abort-controller-prover.mjs'
import { proveSandboxSriIntegritySafety } from './sandbox-guard/sandbox-sri-integrity-prover.mjs'
import { proveSandboxStdioFlushSafety } from './sandbox-guard/sandbox-stdio-flush-prover.mjs'
import { proveSandboxStdinClosureSafety } from './sandbox-guard/sandbox-stdin-close-prover.mjs'
import { proveSandboxPortTransferSafety } from './sandbox-guard/sandbox-port-transfer-prover.mjs'
import { proveSandboxIpcDisconnectSafety } from './sandbox-guard/sandbox-ipc-disconnect-prover.mjs'
import { proveSandboxIpcUnrefSafety } from './sandbox-guard/sandbox-ipc-unref-prover.mjs'
import { proveSandboxPathEnvSafety } from './sandbox-guard/sandbox-path-env-prover.mjs'
import { proveSandboxNodeOptionsSafety } from './sandbox-guard/sandbox-node-options-prover.mjs'
import { proveSandboxLdPreloadSafety } from './sandbox-guard/sandbox-ld-preload-prover.mjs'
import { proveSandboxWorkerHeapLimitSafety } from './sandbox-guard/sandbox-worker-heap-limit-prover.mjs'
import { proveSandboxWorkerTransferListSafety } from './sandbox-guard/sandbox-worker-transfer-list-prover.mjs'
import { proveSandboxProcessWindowsHideSafety } from './sandbox-guard/sandbox-process-windows-hide-prover.mjs'
import { proveSandboxProcessSerializationSafety } from './sandbox-guard/sandbox-process-serialization-prover.mjs'
import { proveSandboxProcessDetachedTeardownSafety } from './sandbox-guard/sandbox-process-detached-teardown-prover.mjs'
import { proveSubprocessDrainSafety } from './sandbox-guard/subprocess-drain-prover.mjs'
import { proveSandboxTempCleanupSafety } from './sandbox-guard/sandbox-temp-cleanup-prover.mjs'
import { proveSocketUnbindSafety } from './sandbox-guard/sandbox-socket-unbind-prover.mjs'
import { proveShmChannelCleanupSafety } from './sandbox-guard/sandbox-shm-cleanup-prover.mjs'
import { auditBrowserStorageQuotaSafety } from './storage-guard/browser-storage-quota-guard.mjs'
import { auditAtomicFileWriteSafety } from './storage-guard/atomic-file-write-guard.mjs'
import { auditFileLockLeaseSafety } from './storage-guard/file-lock-lease-guard.mjs'
import { auditFileUmaskSafety } from './storage-guard/file-umask-guard.mjs'
import { auditTempFileCollisionSafety } from './storage-guard/temp-file-collision-guard.mjs'
import { auditDirectoryTraversalBoundarySafety } from './storage-guard/directory-traversal-boundary-guard.mjs'
import { auditHardlinkRecursionSafety } from './storage-guard/hardlink-recursion-guard.mjs'
import { auditStreamChunkBoundarySafety } from './storage-guard/stream-chunk-boundary-guard.mjs'
import { auditTempSymlinkClashSafety } from './storage-guard/temp-symlink-clash-guard.mjs'
import { auditBufferSliceBoundsSafety } from './storage-guard/buffer-slice-bounds-guard.mjs'
import { auditDeadCssClasses } from './css-guard/dead-css-class-pruner.mjs'
import { provePortCollisionSafety } from './test-guard/port-collision-prover.mjs'
import { estimateTokenComplexity } from './sandbox-runtime/token-complexity-estimator.mjs'
import { synthesizeOpenApiSpec } from './contract-docgen/openapi-synthesizer.mjs'
import { synthesizeE2eTestFlow } from './contract-docgen/e2e-flow-synthesizer.mjs'
import { auditConstitutionDrift } from './consensus-gate/constitution-drift-auditor.mjs'
import { evaluateBftQuorum } from './consensus-gate/bft-quorum-engine.mjs'
import { createWorkspaceMeshNode } from './federation/workspace-mesh-bridge.mjs'
import { createLivePatchKernel } from './runtime-kernel/live-patch-kernel.mjs'
import { auditWorkerTerminationSafety } from './runtime-kernel/worker-termination-guard.mjs'
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
import { auditSpanLifecycleSafety } from './telemetry/span-lifecycle-guard.mjs'
import { auditPiiMaskingSafety } from './telemetry/pii-masking-guard.mjs'
import { createSemanticFabric } from './ontology/semantic-fabric.mjs'
import { optimizeAstRepresentation } from './ast-optimizer/ast-inliner.mjs'
import { evaluateSuperpositionBranches } from './quantum-synthesis/superposition-matrix.mjs'
import { synthesizeFunctionTypesAndSchema } from './type-synthesizer/deep-type-synthesizer.mjs'
import { createTokenHologram } from './hologram/token-hologram.mjs'
import { solveDependencies } from './dependency-solver/polyglot-dependency-solver.mjs'
import { auditPeerDependencyConvergence } from './dependency-solver/peer-dependency-guard.mjs'
import { proveLockfileConvergence } from './dependency-solver/lockfile-divergence-prover.mjs'
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
import { createProvenanceChain } from './provenance/epistemic-provenance-chain.mjs'
import { auditExportLeaks } from './export-guard/export-leak-prover.mjs'
import { calculateBudgetThrottle } from './throttle/budget-auto-throttle.mjs'
import { proveSemanticAstMerge } from './ast-merge/semantic-merge-prover.mjs'
import { auditQueryPerformance } from './query-guard/query-performance-guard.mjs'
import { verifyBundleDrift } from './bundle-guard/bundle-drift-verifier.mjs'
import { createProcessRegistry } from './sandbox-guard/zombie-process-purger.mjs'
import { proveTestInvariants } from './test-guard/mutation-invariant-prover.mjs'
import { auditPayloadDrift } from './payload-guard/payload-drift-guard.mjs'
import { auditBarrelExports } from './export-guard/barrel-export-neutralizer.mjs'
import { proveFilePermissions } from './sandbox-guard/file-permission-prover.mjs'
import { auditAsyncSafety } from './async-guard/promise-cascade-guard.mjs'
import { auditUnhandledRejectionSafety } from './async-guard/unhandled-rejection-guard.mjs'
import { auditSchemaSunset } from './schema-guard/schema-sunset-sentinel.mjs'
import { proveHeapAllocations } from './memory-guard/heap-allocation-prover.mjs'
import { auditNetworkEgress } from './sandbox-guard/egress-interceptor.mjs'
import { auditCssTokenDrift } from './css-guard/css-token-guard.mjs'
import { proveHandleSafety } from './sandbox-guard/handle-leak-prover.mjs'
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
  const provenanceChain = createProvenanceChain()
  const processRegistry = createProcessRegistry()

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
   * Audits file append source code for sequential locking or serialized queue protection.
   *
   * @param {string} sourceCode
   */
  function auditFileAppendLocks(sourceCode) {
    return auditFileAppendLockSafety(sourceCode)
  }

  /**
   * Audits tsconfig.json compilerOptions for leaking Node types in frontend projects.
   *
   * @param {object} tsconfigJson
   * @param {boolean} [isFrontendPackage=false]
   */
  function auditTsconfigRootTypes(tsconfigJson = {}, isFrontendPackage = false) {
    return auditDeadTsconfigRootTypes(tsconfigJson, isFrontendPackage)
  }

  /**
   * Audits X.509 certificate handling source code for explicit host/issuer/validity verification.
   *
   * @param {string} sourceCode
   */
  function auditCryptoX509Certs(sourceCode) {
    return auditCryptoX509CertSafety(sourceCode)
  }

  /**
   * Proves explicit negative PID process group teardown on detached child processes.
   *
   * @param {string} sourceCode
   */
  function auditSandboxProcessDetachedTeardowns(sourceCode) {
    return proveSandboxProcessDetachedTeardownSafety(sourceCode)
  }

  /**
   * Audits stream instantiation source code for objectMode and highWaterMark scale compatibility.
   *
   * @param {string} sourceCode
   */
  function auditStreamObjectModeHighWaterMarks(sourceCode) {
    return auditStreamObjectModeHighWaterMarkSafety(sourceCode)
  }

  /**
   * Audits tsconfig.json compilerOptions for redundant resolveJsonModule declarations.
   *
   * @param {object} tsconfigJson
   */
  function auditTsconfigJsonModules(tsconfigJson = {}) {
    return auditDeadTsconfigJsonModule(tsconfigJson)
  }

  /**
   * Audits AEAD decryption source code for strict setAuthTag before final ordering.
   *
   * @param {string} sourceCode
   */
  function auditCryptoDecipherAuthTags(sourceCode) {
    return auditCryptoDecipherAuthTagSafety(sourceCode)
  }

  /**
   * Proves explicit serialization: 'advanced' configuration in child process fork() calls in sandboxes.
   *
   * @param {string} sourceCode
   */
  function auditSandboxProcessSerializations(sourceCode) {
    return proveSandboxProcessSerializationSafety(sourceCode)
  }

  /**
   * Audits sockets and Duplex streams for proper full-close and destruction handling.
   *
   * @param {string} sourceCode
   */
  function auditStreamHalfCloses(sourceCode) {
    return auditStreamHalfCloseSafety(sourceCode)
  }

  /**
   * Audits tsconfig.json compilerOptions for redundant target-matching lib entries.
   *
   * @param {object} tsconfigJson
   */
  function auditTsconfigTargetLibs(tsconfigJson = {}) {
    return auditDeadTsconfigTargetLib(tsconfigJson)
  }

  /**
   * Audits RSA-PSS signature and verification source code for explicit saltLength specification.
   *
   * @param {string} sourceCode
   */
  function auditCryptoRsaPssPaddings(sourceCode) {
    return auditCryptoRsaPssPaddingSafety(sourceCode)
  }

  /**
   * Proves explicit windowsHide: true in child process spawning within sandboxes.
   *
   * @param {string} sourceCode
   */
  function auditSandboxProcessWindowsHide(sourceCode) {
    return proveSandboxProcessWindowsHideSafety(sourceCode)
  }

  /**
   * Audits stream.pipeline and stream.finished promise usage for proper await/catch handling.
   *
   * @param {string} sourceCode
   */
  function auditStreamPipelineAsync(sourceCode) {
    return auditStreamPipelineAsyncSafety(sourceCode)
  }

  /**
   * Audits tsconfig.json compilerOptions for redundant strict sub-flags.
   *
   * @param {object} tsconfigJson
   */
  function auditTsconfigStrictFlags(tsconfigJson = {}) {
    return auditDeadTsconfigStrictFlags(tsconfigJson)
  }

  /**
   * Audits key pair generation source code for curve hardness and key size safety.
   *
   * @param {string} sourceCode
   */
  function auditCryptoKeyPairs(sourceCode) {
    return auditCryptoKeyPairSafety(sourceCode)
  }

  /**
   * Proves explicit transferList on Worker postMessage binary buffer payloads in sandboxes.
   *
   * @param {string} sourceCode
   */
  function auditSandboxWorkerTransferLists(sourceCode) {
    return proveSandboxWorkerTransferListSafety(sourceCode)
  }

  /**
   * Audits readable stream throttling routines for paired .pause() and .resume() calls.
   *
   * @param {string} sourceCode
   */
  function auditStreamPauseResumes(sourceCode) {
    return auditStreamPauseResumeSafety(sourceCode)
  }

  /**
   * Audits tsconfig.json compilerOptions for redundant ESM interop flags.
   *
   * @param {object} tsconfigJson
   */
  function auditTsconfigInterops(tsconfigJson = {}) {
    return auditDeadTsconfigInterop(tsconfigJson)
  }

  /**
   * Audits EdDSA signature verification source code for algorithm safety.
   *
   * @param {string} sourceCode
   */
  function auditCryptoEddsaVerifications(sourceCode) {
    return auditCryptoEddsaVerifySafety(sourceCode)
  }

  /**
   * Proves explicit resourceLimits and heap bounds on sandbox Worker threads.
   *
   * @param {string} sourceCode
   */
  function auditSandboxWorkerHeapLimits(sourceCode) {
    return proveSandboxWorkerHeapLimitSafety(sourceCode)
  }

  /**
   * Audits writable stream batching routines for paired .cork() and .uncork() calls.
   *
   * @param {string} sourceCode
   */
  function auditStreamCorkUncorks(sourceCode) {
    return auditStreamCorkUncorkSafety(sourceCode)
  }

  /**
   * Audits tsconfig.json compilerOptions for redundant or dead baseUrl settings.
   *
   * @param {object} tsconfigJson
   */
  function auditTsconfigBaseUrls(tsconfigJson = {}) {
    return auditDeadTsconfigBaseUrl(tsconfigJson)
  }

  /**
   * Audits ECDH curve declarations in source code for cryptographic hardness.
   *
   * @param {string} sourceCode
   */
  function auditCryptoEcdhCurves(sourceCode) {
    return auditCryptoEcdhCurveSafety(sourceCode)
  }

  /**
   * Proves sanitized dynamic linker preload environment variable definitions in sandboxes.
   *
   * @param {string} sourceCode
   */
  function auditSandboxLdPreloads(sourceCode) {
    return proveSandboxLdPreloadSafety(sourceCode)
  }

  /**
   * Audits custom Transform/Writable streams for proper _final/_flush callback termination.
   *
   * @param {string} sourceCode
   */
  function auditStreamTransformFinals(sourceCode) {
    return auditStreamTransformFinalSafety(sourceCode)
  }

  /**
   * Audits tsconfig.json compilerOptions for dead or unneeded JSX settings.
   *
   * @param {object} tsconfigJson
   * @param {string[]} existingFilePaths
   */
  function auditTsconfigJsx(tsconfigJson = {}, existingFilePaths = []) {
    return auditDeadTsconfigJsx(tsconfigJson, existingFilePaths)
  }

  /**
   * Audits ChaCha20-Poly1305 encryption/decryption source code for nonce length and auth tag handling.
   *
   * @param {string} sourceCode
   */
  function auditCryptoChachaNonces(sourceCode) {
    return auditCryptoChachaNonceSafety(sourceCode)
  }

  /**
   * Proves sanitized NODE_OPTIONS environment variable definitions in sandboxes.
   *
   * @param {string} sourceCode
   */
  function auditSandboxNodeOptions(sourceCode) {
    return proveSandboxNodeOptionsSafety(sourceCode)
  }

  /**
   * Audits stream piping for auto-destruction and error propagation safety.
   *
   * @param {string} sourceCode
   */
  function auditStreamPipeDestroys(sourceCode) {
    return auditStreamPipeDestroySafety(sourceCode)
  }

  /**
   * Audits tsconfig.json compilerOptions.lib for redundant or incompatible libraries.
   *
   * @param {object} tsconfigJson
   * @param {object} [options]
   */
  function auditTsconfigLibs(tsconfigJson = {}, options = {}) {
    return auditDeadTsconfigLibs(tsconfigJson, options)
  }

  /**
   * Audits Scrypt key derivation calls for robust cost parameters (N >= 16384).
   *
   * @param {string} sourceCode
   */
  function auditCryptoScryptParams(sourceCode) {
    return auditCryptoScryptParamSafety(sourceCode)
  }

  /**
   * Proves sanitized canonical PATH environment variable definitions in sandboxes.
   *
   * @param {string} sourceCode
   */
  function auditSandboxPathEnvs(sourceCode) {
    return proveSandboxPathEnvSafety(sourceCode)
  }

  /**
   * Audits stream allocation options for explicit highWaterMark memory bounding.
   *
   * @param {string} sourceCode
   */
  function auditStreamHighWaterMarks(sourceCode) {
    return auditStreamHighWaterMarkSafety(sourceCode)
  }

  /**
   * Audits tsconfig.json "exclude" globs against existing files and directories.
   *
   * @param {object} tsconfigJson
   * @param {string[]} existingFilesAndDirs
   */
  function auditTsconfigExcludes(tsconfigJson = {}, existingFilesAndDirs = []) {
    return auditDeadTsconfigExcludes(tsconfigJson, existingFilesAndDirs)
  }

  /**
   * Audits HKDF key derivation calls for robust digest and parameter validation.
   *
   * @param {string} sourceCode
   */
  function auditCryptoHkdfParams(sourceCode) {
    return auditCryptoHkdfParamSafety(sourceCode)
  }

  /**
   * Proves explicit child.unref() on detached background daemon processes.
   *
   * @param {string} sourceCode
   */
  function auditSandboxIpcUnrefs(sourceCode) {
    return proveSandboxIpcUnrefSafety(sourceCode)
  }

  /**
   * Audits streams and EventEmitters for MaxListeners bounding or cleanup.
   *
   * @param {string} sourceCode
   */
  function auditStreamMaxListeners(sourceCode) {
    return auditStreamMaxListenersSafety(sourceCode)
  }

  /**
   * Audits tsconfig.json compilerOptions.paths against existing directories.
   *
   * @param {object} tsconfigJson
   * @param {string[]} existingDirPaths
   */
  function auditTsconfigPathPrefixes(tsconfigJson = {}, existingDirPaths = []) {
    return auditDeadTsconfigPathPrefixes(tsconfigJson, existingDirPaths)
  }

  /**
   * Audits Diffie-Hellman key exchange parameters for cryptographic hardness.
   *
   * @param {string} sourceCode
   */
  function auditCryptoDhGroups(sourceCode) {
    return auditCryptoDhGroupSafety(sourceCode)
  }

  /**
   * Proves deterministic IPC channel disconnect in child processes.
   *
   * @param {string} sourceCode
   */
  function auditSandboxIpcDisconnects(sourceCode) {
    return proveSandboxIpcDisconnectSafety(sourceCode)
  }

  /**
   * Audits buffer slicing operations for explicit boundary checks.
   *
   * @param {string} sourceCode
   */
  function auditBufferSliceBounds(sourceCode) {
    return auditBufferSliceBoundsSafety(sourceCode)
  }

  /**
   * Audits tsconfig.json compilerOptions.types against installed packages.
   *
   * @param {object} tsconfigJson
   * @param {string[]} availableTypePackages
   */
  function auditTsconfigTypes(tsconfigJson = {}, availableTypePackages = []) {
    return auditDeadTsconfigTypes(tsconfigJson, availableTypePackages)
  }

  /**
   * Audits RSA key generation options for minimum modulus length safety.
   *
   * @param {string} sourceCode
   */
  function auditCryptoRsaKeyLengths(sourceCode) {
    return auditCryptoRsaKeyLengthSafety(sourceCode)
  }

  /**
   * Proves deterministic MessagePort closure upon worker transfer and teardown.
   *
   * @param {string} sourceCode
   */
  function auditSandboxPortTransfers(sourceCode) {
    return proveSandboxPortTransferSafety(sourceCode)
  }

  /**
   * Audits temporary symlink creation for collision and TOCTOU safety.
   *
   * @param {string} sourceCode
   */
  function auditTempSymlinkClashes(sourceCode) {
    return auditTempSymlinkClashSafety(sourceCode)
  }

  /**
   * Audits tsconfig.json "include" patterns against existing workspace directories.
   *
   * @param {object} tsconfigJson
   * @param {string[]} existingFilesAndDirs
   */
  function auditTsconfigIncludes(tsconfigJson = {}, existingFilesAndDirs = []) {
    return auditDeadTsconfigIncludes(tsconfigJson, existingFilesAndDirs)
  }

  /**
   * Audits PBKDF2 key derivation calls for robust digest algorithm specification.
   *
   * @param {string} sourceCode
   */
  function auditCryptoPbkdf2Digests(sourceCode) {
    return auditCryptoPbkdf2DigestSafety(sourceCode)
  }

  /**
   * Proves deterministic stdin closure in child processes.
   *
   * @param {string} sourceCode
   */
  function auditSandboxStdinClosure(sourceCode) {
    return proveSandboxStdinClosureSafety(sourceCode)
  }

  /**
   * Audits stream data reading for safe multi-byte UTF-8 chunk boundary decoding.
   *
   * @param {string} sourceCode
   */
  function auditStreamChunkBoundaries(sourceCode) {
    return auditStreamChunkBoundarySafety(sourceCode)
  }

  /**
   * Audits tsconfig.json project references against existing workspace directories.
   *
   * @param {object} tsconfigJson
   * @param {string[]} existingProjectPaths
   */
  function auditTsconfigReferences(tsconfigJson = {}, existingProjectPaths = []) {
    return auditDeadTsconfigReferences(tsconfigJson, existingProjectPaths)
  }

  /**
   * Audits TLS/HTTPS socket and agent configurations for secure minimum TLS version.
   *
   * @param {string} sourceCode
   */
  function auditCryptoTlsVersions(sourceCode) {
    return auditCryptoTlsVersionSafety(sourceCode)
  }

  /**
   * Proves complete stdio stream flush before process exit in sandboxes.
   *
   * @param {string} sourceCode
   */
  function auditSandboxStdioFlush(sourceCode) {
    return proveSandboxStdioFlushSafety(sourceCode)
  }

  /**
   * Audits directory walking for inode tracking or maxDepth hardlink bounding.
   *
   * @param {string} sourceCode
   */
  function auditHardlinkRecursions(sourceCode) {
    return auditHardlinkRecursionSafety(sourceCode)
  }

  /**
   * Audits package.json "bin" executable entrypoints against existing files.
   *
   * @param {object} packageJson
   * @param {string[]} existingFiles
   */
  function auditPackageBinaries(packageJson = {}, existingFiles = []) {
    return auditDeadPackageBinaries(packageJson, existingFiles)
  }

  /**
   * Audits EC cryptography declarations for robust curve parameters.
   *
   * @param {string} sourceCode
   */
  function auditEcCurves(sourceCode) {
    return auditCryptoEcCurveSafety(sourceCode)
  }

  /**
   * Proves Subresource Integrity (SRI) on dynamic remote module loads in sandboxes.
   *
   * @param {string} sourceCode
   */
  function auditSriIntegrity(sourceCode) {
    return proveSandboxSriIntegritySafety(sourceCode)
  }

  /**
   * Audits path resolution for canonical workspace boundary anchoring.
   *
   * @param {string} sourceCode
   */
  function auditDirectoryBoundaries(sourceCode) {
    return auditDirectoryTraversalBoundarySafety(sourceCode)
  }

  /**
   * Audits package.json for dead or broken export condition targets.
   *
   * @param {object} packageJson
   * @param {string[]} existingFiles
   */
  function auditExportConditions(packageJson = {}, existingFiles = []) {
    return auditDeadPackageExportConditions(packageJson, existingFiles)
  }

  /**
   * Audits signature/token verification for constant-time Buffer comparisons.
   *
   * @param {string} sourceCode
   */
  function auditTimingSafeBuffers(sourceCode) {
    return auditCryptoTimingSafeBufferSafety(sourceCode)
  }

  /**
   * Proves responsive AbortSignal task cancellation in async workers.
   *
   * @param {string} sourceCode
   */
  function auditAbortControllers(sourceCode) {
    return proveSandboxAbortControllerSafety(sourceCode)
  }

  /**
   * Audits temporary file creation for cryptographically non-colliding prefixes.
   *
   * @param {string} sourceCode
   */
  function auditTempFiles(sourceCode) {
    return auditTempFileCollisionSafety(sourceCode)
  }

  /**
   * Audits package.json for dead or broken lifecycle script hooks.
   *
   * @param {object} packageJson
   * @param {string[]} validCommandsOrScripts
   */
  function auditScriptHooks(packageJson = {}, validCommandsOrScripts = []) {
    return auditDeadScriptHooks(packageJson, validCommandsOrScripts)
  }

  /**
   * Audits symmetric encryption for modern authenticated AEAD/GCM cipher modes.
   *
   * @param {string} sourceCode
   */
  function auditCipherModes(sourceCode) {
    return auditCryptoCipherModeSafety(sourceCode)
  }

  /**
   * Proves bounded IPC payload size and prevents V8 serialization crashes in sandboxes.
   *
   * @param {string} sourceCode
   */
  function auditSandboxIpcPayloads(sourceCode) {
    return proveSandboxIpcPayloadSafety(sourceCode)
  }

  /**
   * Audits file and directory creation for secure POSIX permissions and umask enforcement.
   *
   * @param {string} sourceCode
   */
  function auditFileUmask(sourceCode) {
    return auditFileUmaskSafety(sourceCode)
  }

  /**
   * Audits package.json for dead workspace protocol dependencies.
   *
   * @param {object} packageJson
   * @param {string[]} registeredWorkspacePackages
   */
  function auditWorkspaceProtocols(packageJson = {}, registeredWorkspacePackages = []) {
    return auditDeadWorkspaceProtocols(packageJson, registeredWorkspacePackages)
  }

  /**
   * Audits key derivation calls for safe salt length and OWASP iteration counts.
   *
   * @param {string} sourceCode
   */
  function auditCryptoKdf(sourceCode) {
    return auditCryptoKdfSafety(sourceCode)
  }

  /**
   * Proves maxBuffer bounds on subprocess execution in sandboxes.
   *
   * @param {string} sourceCode
   */
  function auditSandboxMaxBuffer(sourceCode) {
    return proveSandboxMaxBufferSafety(sourceCode)
  }

  /**
   * Audits file lock routines for stale lock detection and lease TTL expiration.
   *
   * @param {string} sourceCode
   */
  function auditFileLocks(sourceCode) {
    return auditFileLockLeaseSafety(sourceCode)
  }

  /**
   * Audits barrel files for duplicate re-exported symbols.
   *
   * @param {string} sourceCode
   */
  function auditBarrelDuplicates(sourceCode) {
    return auditDeadBarrelDuplicates(sourceCode)
  }

  /**
   * Audits system command executions for argument escaping and safe quoting.
   *
   * @param {string} sourceCode
   */
  function auditShellCommands(sourceCode) {
    return auditShellQuoteSafety(sourceCode)
  }

  /**
   * Proves process group signal trapping and child process tree containment in sandbox.
   *
   * @param {string} sourceCode
   */
  function auditSandboxSignalTraps(sourceCode) {
    return proveSandboxSignalTrapSafety(sourceCode)
  }

  /**
   * Audits state writes for staged atomic temp-file-and-rename safety.
   *
   * @param {string} sourceCode
   */
  function auditAtomicWrites(sourceCode) {
    return auditAtomicFileWriteSafety(sourceCode)
  }

  /**
   * Audits declared config aliases against consumer codebase to prune dead aliases.
   *
   * @param {string[]} declaredAliases
   * @param {string} consumerCodebase
   */
  function auditConfigAliases(declaredAliases = [], consumerCodebase = '') {
    return auditDeadConfigAliases(declaredAliases, consumerCodebase)
  }

  /**
   * Audits RegExp declarations for Unicode u/v flag safety.
   *
   * @param {string} sourceCode
   */
  function auditRegexUnicode(sourceCode) {
    return auditRegexUnicodeSafety(sourceCode)
  }

  /**
   * Proves worker scheduling priority and niceness in sandbox executions.
   *
   * @param {string} sourceCode
   */
  function auditSandboxPriority(sourceCode) {
    return proveSandboxPrioritySafety(sourceCode)
  }

  /**
   * Audits process entrypoint for unhandled rejection and exception safety.
   *
   * @param {string} sourceCode
   */
  function auditUnhandledRejections(sourceCode) {
    return auditUnhandledRejectionSafety(sourceCode)
  }

  /**
   * Audits monorepo workspace packages for dead unreferenced packages.
   *
   * @param {string[]} declaredPackages
   * @param {string} consumerReferences
   */
  function auditWorkspacePackages(declaredPackages = [], consumerReferences = '') {
    return auditDeadWorkspacePackages(declaredPackages, consumerReferences)
  }

  /**
   * Audits CSPRNG cryptographic randomness enforcement in tokens/secrets.
   *
   * @param {string} sourceCode
   */
  function auditCryptoRandomness(sourceCode) {
    return auditCryptoRandomSafety(sourceCode)
  }

  /**
   * Proves file descriptor isolation in sandbox subprocess spawns.
   *
   * @param {string} sourceCode
   */
  function auditSandboxFdIsolation(sourceCode) {
    return proveSandboxFdIsolationSafety(sourceCode)
  }

  /**
   * Audits logging and telemetry statements for unmasked PII and credentials.
   *
   * @param {string} sourceCode
   */
  function auditPiiMasking(sourceCode) {
    return auditPiiMaskingSafety(sourceCode)
  }

  /**
   * Audits .gitignore patterns to prune duplicates and redundant rules.
   *
   * @param {string[]} rules
   */
  function auditGitignore(rules = []) {
    return auditDeadGitignoreRules(rules)
  }

  /**
   * Audits cryptographic hash functions for unsafe legacy algorithms.
   *
   * @param {string} sourceCode
   */
  function auditCryptoAlgorithms(sourceCode) {
    return auditCryptoAlgorithmSafety(sourceCode)
  }

  /**
   * Proves CPU and memory bounds on sandbox subprocesses.
   *
   * @param {string} sourceCode
   */
  function auditSandboxRLimits(sourceCode) {
    return proveSandboxRLimitSafety(sourceCode)
  }

  /**
   * Audits outbound HTTP requests for explicit timeouts or AbortSignal.
   *
   * @param {string} sourceCode
   */
  function auditHttpTimeouts(sourceCode) {
    return auditHttpRequestTimeoutSafety(sourceCode)
  }

  /**
   * Audits markdown documents to detect broken internal links.
   *
   * @param {string} markdownContent
   * @param {string[]} validPaths
   */
  function auditMarkdownDocLinks(markdownContent = '', validPaths = []) {
    return auditDeadMarkdownDocLinks(markdownContent, validPaths)
  }

  /**
   * Audits dynamic RegExp instantiation for bounded length and ReDoS safety.
   *
   * @param {string} sourceCode
   */
  function auditDynamicRegExps(sourceCode) {
    return auditDynamicRegexSafety(sourceCode)
  }

  /**
   * Proves core dump disabling in sandbox child process spawn.
   *
   * @param {string} sourceCode
   */
  function auditSandboxCoreDumps(sourceCode) {
    return proveSandboxCoreDumpSafety(sourceCode)
  }

  /**
   * Audits database transactions for guaranteed rollback on failure.
   *
   * @param {string} sourceCode
   */
  function auditDbTransactionSafety(sourceCode) {
    return auditTransactionRollbackSafety(sourceCode)
  }

  /**
   * Audits package.json scripts against monorepo codebase to prune dead scripts.
   *
   * @param {string[]} declaredScripts
   * @param {string} consumerCodebase
   */
  function auditDeadScriptCoverage(declaredScripts = [], consumerCodebase = '') {
    return auditDeadPackageScripts(declaredScripts, consumerCodebase)
  }

  /**
   * Audits HTML bindings to enforce DOMPurify/sanitization against XSS.
   *
   * @param {string} sourceCode
   */
  function auditHtmlSanitization(sourceCode) {
    return auditHtmlSanitizationSafety(sourceCode)
  }

  /**
   * Proves explicit environment variable isolation in sandbox subprocesses.
   *
   * @param {string} sourceCode
   */
  function auditSandboxEnvIsolation(sourceCode) {
    return proveSandboxEnvIsolationSafety(sourceCode)
  }

  /**
   * Audits browser storage operations for quota and exception handling.
   *
   * @param {string} sourceCode
   */
  function auditBrowserStorage(sourceCode) {
    return auditBrowserStorageQuotaSafety(sourceCode)
  }

  /**
   * Audits custom CSS classes against consumer templates to prune dead ones.
   *
   * @param {string[]} declaredClasses
   * @param {string} consumerTemplateCode
   */
  function auditDeadCssClassCoverage(declaredClasses = [], consumerTemplateCode = '') {
    return auditDeadCssClasses(declaredClasses, consumerTemplateCode)
  }

  /**
   * Proves ephemeral port binding to prevent parallel test port collisions.
   *
   * @param {string} sourceCode
   */
  function auditPortCollisions(sourceCode) {
    return provePortCollisionSafety(sourceCode)
  }

  /**
   * Proves bounded file descriptor concurrency to prevent ulimit/EMFILE exhaustion.
   *
   * @param {string} sourceCode
   */
  function auditSandboxUlimit(sourceCode) {
    return proveSandboxUlimitSafety(sourceCode)
  }

  /**
   * Audits worker thread managers for guaranteed termination.
   *
   * @param {string} sourceCode
   */
  function auditWorkerTeardown(sourceCode) {
    return auditWorkerTerminationSafety(sourceCode)
  }

  /**
   * Audits Pinia/Vuex store state properties for dead unreferenced properties.
   *
   * @param {string[]} stateProperties
   * @param {string} consumerSourceCode
   */
  function auditDeadStoreStateCoverage(stateProperties = [], consumerSourceCode = '') {
    return auditDeadStoreState(stateProperties, consumerSourceCode)
  }

  /**
   * Audits streaming writes for backpressure flow control.
   *
   * @param {string} sourceCode
   */
  function auditStreamBackpressure(sourceCode) {
    return auditStreamBackpressureSafety(sourceCode)
  }

  /**
   * Proves prohibition of setuid/setgid and privilege escalation commands in sandbox.
   *
   * @param {string} commandOrSourceCode
   */
  function auditPrivilegeEscalation(commandOrSourceCode) {
    return provePrivilegeEscalationSafety(commandOrSourceCode)
  }

  /**
   * Audits OpenTelemetry spans for guaranteed termination in finally blocks.
   *
   * @param {string} sourceCode
   */
  function auditSpanLifecycle(sourceCode) {
    return auditSpanLifecycleSafety(sourceCode)
  }

  /**
   * Audits declared environment variables to detect dead unreferenced ones.
   *
   * @param {string[]} declaredEnvKeys
   * @param {string} consumerSourceCode
   */
  function auditDeadEnvFlagCoverage(declaredEnvKeys = [], consumerSourceCode = '') {
    return auditDeadEnvFlags(declaredEnvKeys, consumerSourceCode)
  }

  /**
   * Audits GraphQL / API query handlers for depth limit protection.
   *
   * @param {string} sourceCode
   */
  function auditQueryDepth(sourceCode) {
    return auditQueryDepthSafety(sourceCode)
  }

  /**
   * Proves MessageChannel and shared memory handle closure in teardown hooks.
   *
   * @param {string} sourceCode
   */
  function auditShmChannelCleanup(sourceCode) {
    return proveShmChannelCleanupSafety(sourceCode)
  }

  /**
   * Proves explicit database connection pool drain and teardown.
   *
   * @param {string} sourceCode
   */
  function auditDbPoolTeardown(sourceCode) {
    return proveDbPoolDrainSafety(sourceCode)
  }

  /**
   * Audits translation keys to detect dead and unreferenced i18n keys.
   *
   * @param {string[]} translationKeys
   * @param {string} consumerSourceCode
   */
  function auditDeadI18nKeyCoverage(translationKeys = [], consumerSourceCode = '') {
    return auditDeadI18nKeys(translationKeys, consumerSourceCode)
  }

  /**
   * Audits JWT signing calls to ensure an explicit expiration policy is declared.
   *
   * @param {string} sourceCode
   */
  function auditJwtExpiration(sourceCode) {
    return auditJwtExpirationSafety(sourceCode)
  }

  /**
   * Proves that symlink operations remain strictly contained inside the sandbox.
   *
   * @param {string} sandboxRoot
   * @param {string} symlinkTarget
   */
  function auditSymlinkContainment(sandboxRoot, symlinkTarget) {
    return proveSymlinkContainment(sandboxRoot, symlinkTarget)
  }

  /**
   * Audits WebSocket server handlers for heartbeat interval teardown.
   *
   * @param {string} sourceCode
   */
  function auditWebSocketHeartbeats(sourceCode) {
    return auditWebSocketHeartbeat(sourceCode)
  }

  /**
   * Audits exported type aliases to detect dead unreferenced ones.
   *
   * @param {string[]} typeAliasNames
   * @param {string} consumerSourceCode
   */
  function auditDeadTypeAliasHierarchy(typeAliasNames = [], consumerSourceCode = '') {
    return auditDeadTypeAliases(typeAliasNames, consumerSourceCode)
  }

  /**
   * Audits API route payload deserialization for schema validation safety.
   *
   * @param {string} sourceCode
   */
  function auditPayloadDeserialization(sourceCode) {
    return auditPayloadDeserializationSafety(sourceCode)
  }

  /**
   * Proves network listen sockets are closed in teardown hooks.
   *
   * @param {string} sourceCode
   */
  function auditSocketUnbind(sourceCode) {
    return proveSocketUnbindSafety(sourceCode)
  }

  /**
   * Audits route source code for rate limiting protection.
   *
   * @param {string} sourceCode
   * @param {boolean} [isPublicOrAuth=true]
   */
  function auditRateLimits(sourceCode, isPublicOrAuth = true) {
    return auditRateLimiting(sourceCode, isPublicOrAuth)
  }

  /**
   * Audits package.json export subpaths against consumer codebase.
   *
   * @param {string} packageName
   * @param {string[]} exportSubpaths
   * @param {string} consumerSourceCode
   */
  function auditPackageExportCoverage(packageName, exportSubpaths = [], consumerSourceCode = '') {
    return auditDeadPackageExports(packageName, exportSubpaths, consumerSourceCode)
  }

  /**
   * Audits Vue SFC components for SSR hydration safety.
   *
   * @param {string} sfcSourceCode
   */
  function auditComponentHydration(sfcSourceCode) {
    return auditHydrationSafety(sfcSourceCode)
  }

  /**
   * Proves recursive cleanup of ephemeral temporary directories in sandbox.
   *
   * @param {string} sourceCode
   */
  function auditSandboxTempCleanup(sourceCode) {
    return proveSandboxTempCleanupSafety(sourceCode)
  }

  /**
   * Audits mutation endpoints for cache invalidation directives.
   *
   * @param {string} sourceCode
   * @param {string} [httpMethod='POST']
   */
  function auditCacheHeaders(sourceCode, httpMethod = 'POST') {
    return auditCacheInvalidation(sourceCode, httpMethod)
  }

  /**
   * Audits exported enums and constants to detect dead unreferenced ones.
   *
   * @param {string[]} enumNames
   * @param {string} consumerSourceCode
   */
  function auditDeadEnumHierarchy(enumNames = [], consumerSourceCode = '') {
    return auditDeadEnums(enumNames, consumerSourceCode)
  }

  /**
   * Audits file read operations for unsanitized path traversal.
   *
   * @param {string} sourceCode
   */
  function auditPathTraversal(sourceCode) {
    return auditPathTraversalSafety(sourceCode)
  }

  /**
   * Proves that subprocess streams are drained and deadlock-free.
   *
   * @param {string} sourceCode
   */
  function auditSubprocessDraining(sourceCode) {
    return proveSubprocessDrainSafety(sourceCode)
  }

  /**
   * Proves SSE/WebSocket stream abort handling and interval cleanup.
   *
   * @param {string} sourceCode
   */
  function auditStreamTeardown(sourceCode) {
    return proveStreamTeardownSafety(sourceCode)
  }

  /**
   * Audits exported types against consumer codebases to detect dead types.
   *
   * @param {string[]} exportedTypes
   * @param {string} consumerSourceCode
   */
  function auditDeadTypeHierarchy(exportedTypes = [], consumerSourceCode = '') {
    return auditDeadTypes(exportedTypes, consumerSourceCode)
  }

  /**
   * Audits database queries for dynamic string interpolation/concatenation risks.
   *
   * @param {string} sourceCode
   */
  function auditSqlQuerySecurity(sourceCode) {
    return auditSqlSecurity(sourceCode)
  }

  /**
   * Proves path containment inside assigned sandbox root directory.
   *
   * @param {string} sandboxRoot
   * @param {string} targetPath
   */
  function auditPathContainment(sandboxRoot, targetPath) {
    return provePathContainment(sandboxRoot, targetPath)
  }

  /**
   * Proves lockfile version convergence for critical packages.
   *
   * @param {Record<string, string[]>} lockfilePackageVersions
   * @param {string[]} criticalPackages
   */
  function auditLockfileConvergence(lockfilePackageVersions = {}, criticalPackages = []) {
    return proveLockfileConvergence(lockfilePackageVersions, criticalPackages)
  }

  /**
   * Audits HTTP headers and CORS origins for security.
   *
   * @param {string} sourceCode
   */
  function auditHttpCorsSecurity(sourceCode) {
    return auditHttpHeadersAndCors(sourceCode)
  }

  /**
   * Audits Vue components for unrendered dead components.
   *
   * @param {string[]} componentNames
   * @param {string} appTemplateCode
   */
  function auditDeadComponentTree(componentNames = [], appTemplateCode = '') {
    return auditDeadComponents(componentNames, appTemplateCode)
  }

  /**
   * Proves deterministic closure and cleanup of IPC pipes and domain sockets.
   *
   * @param {string} sourceCode
   */
  function auditPipeCleanup(sourceCode) {
    return provePipeCleanupSafety(sourceCode)
  }

  /**
   * Audits environment variables and secret leaks.
   *
   * @param {string} sourceCode
   * @param {string[]} declaredEnvVars
   */
  function auditEnvSafety(sourceCode, declaredEnvVars = []) {
    return auditEnvAndSecrets(sourceCode, declaredEnvVars)
  }

  /**
   * Validates structural config AST integrity.
   *
   * @param {string} content
   * @param {string} [format='json']
   */
  function auditConfigStructure(content, format = 'json') {
    return validateStructuralConfig(content, format)
  }

  /**
   * Audits dead and orphan API routes.
   *
   * @param {string[]} declaredRoutes
   * @param {string} clientSourceCode
   */
  function auditDeadRouteCoverage(declaredRoutes = [], clientSourceCode = '') {
    return auditDeadRoutes(declaredRoutes, clientSourceCode)
  }

  /**
   * Proves graceful signal teardown on process listeners.
   *
   * @param {string} sourceCode
   */
  function auditSignalTeardownSafety(sourceCode) {
    return proveSignalTeardown(sourceCode)
  }

  /**
   * Audits peer dependency convergence across monorepo packages.
   *
   * @param {Array<{ name: string, peerDependencies?: Record<string, string>, dependencies?: Record<string, string> }>} packages
   */
  function auditPeerDependencies(packages = []) {
    return auditPeerDependencyConvergence(packages)
  }

  /**
   * Proves regular expression safety against ReDoS attacks.
   *
   * @param {string} sourceCode
   */
  function auditRedosVulnerabilities(sourceCode) {
    return proveRedosSafety(sourceCode)
  }

  /**
   * Audits CSS custom properties for token drift.
   *
   * @param {string} sourceCode
   * @param {string[]} declaredTokens
   */
  function auditCssTokens(sourceCode, declaredTokens = []) {
    return auditCssTokenDrift(sourceCode, declaredTokens)
  }

  /**
   * Proves deterministic closure of opened file handles.
   *
   * @param {string} sourceCode
   */
  function auditFileHandlesSafety(sourceCode) {
    return proveHandleSafety(sourceCode)
  }

  /**
   * Audits asynchronous safety and prevents infinite promise cascades.
   *
   * @param {string} sourceCode
   */
  function auditAsyncEventLoop(sourceCode) {
    return auditAsyncSafety(sourceCode)
  }

  /**
   * Audits schema field deprecation and sunsets.
   *
   * @param {string} sourceCode
   * @param {Array<{ name: string, replacement?: string }>} deprecatedFields
   */
  function auditFieldDeprecations(sourceCode, deprecatedFields = []) {
    return auditSchemaSunset(sourceCode, deprecatedFields)
  }

  /**
   * Proves heap memory allocation safety.
   *
   * @param {string} sourceCode
   */
  function auditHeapAllocationSafety(sourceCode) {
    return proveHeapAllocations(sourceCode)
  }

  /**
   * Audits sandbox network egress isolation.
   *
   * @param {string} sourceCode
   */
  function auditSandboxEgress(sourceCode) {
    return auditNetworkEgress(sourceCode)
  }

  /**
   * Proves test invariants and verifies presence of assertions.
   *
   * @param {string} testCode
   */
  function auditTestInvariants(testCode) {
    return proveTestInvariants(testCode)
  }

  /**
   * Audits payload drift between frontend and backend schemas.
   *
   * @param {string[]} clientKeys
   * @param {string[]} backendKeys
   */
  function auditPayloadAlignment(clientKeys = [], backendKeys = []) {
    return auditPayloadDrift(clientKeys, backendKeys)
  }

  /**
   * Audits barrel files for dangerous wildcard star exports.
   *
   * @param {string} sourceCode
   */
  function auditBarrelIndex(sourceCode) {
    return auditBarrelExports(sourceCode)
  }

  /**
   * Proves least-privilege file permissions in sandbox.
   *
   * @param {string} sourceCode
   */
  function auditFilePermissionsSafety(sourceCode) {
    return proveFilePermissions(sourceCode)
  }

  /**
   * Reconciles 3-way AST modifications semantically.
   *
   * @param {object} mergeOptions
   */
  function mergeAstBranches(mergeOptions) {
    return proveSemanticAstMerge(mergeOptions)
  }

  /**
   * Audits queries for missing indexes and N+1 patterns.
   *
   * @param {string} sourceCode
   * @param {string[]} indexedColumns
   */
  function auditDbQueries(sourceCode, indexedColumns = []) {
    return auditQueryPerformance(sourceCode, indexedColumns)
  }

  /**
   * Audits bundle imports for heavy dependencies and tree-shaking drift.
   *
   * @param {string} sourceCode
   */
  function auditBundleImports(sourceCode) {
    return verifyBundleDrift(sourceCode)
  }

  /**
   * Purges zombie processes and returns verification proof.
   *
   * @param {Function} [killFn]
   */
  function purgeZombiePids(killFn = null) {
    return processRegistry.purgeZombieProcesses(killFn)
  }

  /**
   * Appends an immutable cryptographic provenance block.
   *
   * @param {object} entry
   */
  function recordProvenance(entry) {
    return provenanceChain.appendProvenanceBlock(entry)
  }

  /**
   * Audits export leaks across package boundaries.
   *
   * @param {string} sourceCode
   * @param {string[]} protectedPackages
   */
  function auditPackageExports(sourceCode, protectedPackages = []) {
    return auditExportLeaks(sourceCode, protectedPackages)
  }

  /**
   * Computes adaptive auto-throttle policy.
   *
   * @param {number} spentTokens
   */
  function checkThrottlePolicy(spentTokens) {
    return calculateBudgetThrottle({ spentTokens, totalBudget: globalTokenBudget })
  }

  /**
   * Audits constant-time cryptographic safety.
   *
   * @param {string} sourceCode
   */
  function auditTimingAttackSafety(sourceCode) {
    return auditTimingSafety(sourceCode)
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
      version: '58.0.0',
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
   * @param {Record<string, currCols>} currCols
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
    provenanceChain,
    processRegistry,
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
    auditFileAppendLocks,
    auditTsconfigRootTypes,
    auditCryptoX509Certs,
    auditSandboxProcessDetachedTeardowns,
    auditStreamObjectModeHighWaterMarks,
    auditTsconfigJsonModules,
    auditCryptoDecipherAuthTags,
    auditSandboxProcessSerializations,
    auditStreamHalfCloses,
    auditTsconfigTargetLibs,
    auditCryptoRsaPssPaddings,
    auditSandboxProcessWindowsHide,
    auditStreamPipelineAsync,
    auditTsconfigStrictFlags,
    auditCryptoKeyPairs,
    auditSandboxWorkerTransferLists,
    auditStreamPauseResumes,
    auditTsconfigInterops,
    auditCryptoEddsaVerifications,
    auditSandboxWorkerHeapLimits,
    auditStreamCorkUncorks,
    auditTsconfigBaseUrls,
    auditCryptoEcdhCurves,
    auditSandboxLdPreloads,
    auditStreamTransformFinals,
    auditTsconfigJsx,
    auditCryptoChachaNonces,
    auditSandboxNodeOptions,
    auditStreamPipeDestroys,
    auditTsconfigLibs,
    auditCryptoScryptParams,
    auditSandboxPathEnvs,
    auditStreamHighWaterMarks,
    auditTsconfigExcludes,
    auditCryptoHkdfParams,
    auditSandboxIpcUnrefs,
    auditStreamMaxListeners,
    auditTsconfigPathPrefixes,
    auditCryptoDhGroups,
    auditSandboxIpcDisconnects,
    auditBufferSliceBounds,
    auditTsconfigTypes,
    auditCryptoRsaKeyLengths,
    auditSandboxPortTransfers,
    auditTempSymlinkClashes,
    auditTsconfigIncludes,
    auditCryptoPbkdf2Digests,
    auditSandboxStdinClosure,
    auditStreamChunkBoundaries,
    auditTsconfigReferences,
    auditCryptoTlsVersions,
    auditSandboxStdioFlush,
    auditHardlinkRecursions,
    auditPackageBinaries,
    auditEcCurves,
    auditSriIntegrity,
    auditDirectoryBoundaries,
    auditExportConditions,
    auditTimingSafeBuffers,
    auditAbortControllers,
    auditTempFiles,
    auditScriptHooks,
    auditCipherModes,
    auditSandboxIpcPayloads,
    auditFileUmask,
    auditWorkspaceProtocols,
    auditCryptoKdf,
    auditSandboxMaxBuffer,
    auditFileLocks,
    auditBarrelDuplicates,
    auditShellCommands,
    auditSandboxSignalTraps,
    auditAtomicWrites,
    auditConfigAliases,
    auditRegexUnicode,
    auditSandboxPriority,
    auditUnhandledRejections,
    auditWorkspacePackages,
    auditCryptoRandomness,
    auditSandboxFdIsolation,
    auditPiiMasking,
    auditGitignore,
    auditCryptoAlgorithms,
    auditSandboxRLimits,
    auditHttpTimeouts,
    auditMarkdownDocLinks,
    auditDynamicRegExps,
    auditSandboxCoreDumps,
    auditDbTransactionSafety,
    auditDeadScriptCoverage,
    auditHtmlSanitization,
    auditSandboxEnvIsolation,
    auditBrowserStorage,
    auditDeadCssClassCoverage,
    auditPortCollisions,
    auditSandboxUlimit,
    auditWorkerTeardown,
    auditDeadStoreStateCoverage,
    auditStreamBackpressure,
    auditPrivilegeEscalation,
    auditSpanLifecycle,
    auditDeadEnvFlagCoverage,
    auditQueryDepth,
    auditShmChannelCleanup,
    auditDbPoolTeardown,
    auditDeadI18nKeyCoverage,
    auditJwtExpiration,
    auditSymlinkContainment,
    auditWebSocketHeartbeats,
    auditDeadTypeAliasHierarchy,
    auditPayloadDeserialization,
    auditSocketUnbind,
    auditRateLimits,
    auditPackageExportCoverage,
    auditComponentHydration,
    auditSandboxTempCleanup,
    auditCacheHeaders,
    auditDeadEnumHierarchy,
    auditPathTraversal,
    auditSubprocessDraining,
    auditStreamTeardown,
    auditDeadTypeHierarchy,
    auditSqlQuerySecurity,
    auditPathContainment,
    auditLockfileConvergence,
    auditHttpCorsSecurity,
    auditDeadComponentTree,
    auditPipeCleanup,
    auditEnvSafety,
    auditConfigStructure,
    auditDeadRouteCoverage,
    auditSignalTeardownSafety,
    auditPeerDependencies,
    auditRedosVulnerabilities,
    auditCssTokens,
    auditFileHandlesSafety,
    auditAsyncEventLoop,
    auditFieldDeprecations,
    auditHeapAllocationSafety,
    auditSandboxEgress,
    auditTestInvariants,
    auditPayloadAlignment,
    auditBarrelIndex,
    auditFilePermissionsSafety,
    mergeAstBranches,
    auditDbQueries,
    auditBundleImports,
    purgeZombiePids,
    recordProvenance,
    auditPackageExports,
    checkThrottlePolicy,
    auditTimingAttackSafety,
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

  process.stdout.write(`✅ AOI-OS v58: Successfully compiled DAG from ${filePath}\n`)
  process.stdout.write(`   Nodes: ${pipeline.rawNodes.length} | Waves: ${pipeline.batches.length}\n`)
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main()
}
