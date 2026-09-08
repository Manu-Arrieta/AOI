#!/usr/bin/env node
/**
 * scripts/sdd-lifecycle/sdd-stress-suite.mjs
 *
 * Comprehensive End-to-End Stress Test & Token Accounting Suite for AOI SDD Lifecycle.
 * Evaluates token expenditure and savings across ALL 6 phases:
 * Phase 0: /sdd-frame (Pre-Flight & O(1) Fact Grounding)
 * Phase 1: /sdd-new (Explore & Calibrated Relevance-Contrast)
 * Phase 2: /sdd-ff (Specify/Plan & TOON Subagent Serialization)
 * Phase 3: /sdd-apply (Implement: AST-Lens, Zero-Token Scaffolding, Context Tombstoning)
 * Phase 4: /sdd-verify (Verify: Mechanical Set Union, Diagnostic Distiller, 0-Token Rollback)
 * Phase 5: /sdd-archive (Archive: Registry seal & Fast Briefing)
 */

import fs from 'node:fs'
import path from 'node:path'
import { skeletonizeCode } from '../code-lens/ast-skeletonizer.mjs'
import { scaffoldTaskFromSpecs } from './synthesize-stubs.mjs'
import { shrinkTurns } from '../subagent-context/context-tombstone.mjs'
import { distillTestOutput, distillTscOutput } from './diagnostic-distiller.mjs'
import { unifyVerificationReports } from './mechanical-verify-union.mjs'
import { arrangeContext } from './context-arranger.mjs'
import { buildSubagentPayload } from '../subagent-context/sanitize-subagent-payload.mjs'
import { createSubagentSandbox } from '../subagent-context/subagent-fiber-runner.mjs'
import { auditPromptsDirectory } from '../multi-harness/cache-guard.mjs'
import { formatUnifiedVerificationReport } from './mechanical-verify-union.mjs'
import {
  createLedger, estimateTokens, findRealTaskDir, formatTotals, readIfPresent,
  toTableRows, tryCommand, FIXTURE, MEASURED, SKIPPED,
} from './token-accounting.mjs'

const ledger = createLedger()
const WORKSPACE = path.basename(process.cwd())
// Phases prefer real artifacts from an actual task; without one they fall back
// to fixtures and say so, instead of quietly printing an invented constant.
const REAL_TASK_DIR = findRealTaskDir(process.cwd())

console.log('═══════════════════════════════════════════════════════════════════════════════')
console.log('   AOI SDD LIFECYCLE END-TO-END STRESS TEST & TOKEN TELEMETRY CERTIFICATION   ')
console.log('═══════════════════════════════════════════════════════════════════════════════\n')

// ─────────────────────────────────────────────────────────────────────────────
// FASE 0: /sdd-frame — Pre-Flight & Grounding
// ─────────────────────────────────────────────────────────────────────────────
console.log('▶ [Fase 0: /sdd-frame] Testing Socratic Grounding in O(1)...')
// Measured against the live ICM store: the deterministic grounding probe the
// prompt actually runs, versus the semantic recall it replaces.
const groundingProbe = [
  tryCommand('icm', ['facts', 'list', WORKSPACE, '-p', 'service.', '--read-only']).stdout,
  tryCommand('icm', ['facts', 'list', WORKSPACE, '-p', 'endpoint.', '--read-only']).stdout,
  tryCommand('icm', ['wake-up']).stdout,
].join('')
const naiveRecall = tryCommand('icm', ['recall', 'project context stack conventions services', '--limit', '20']).stdout

if (groundingProbe.trim() && naiveRecall.trim()) {
  const p0 = ledger.record('Phase_0_Frame', '/sdd-frame (Pre-Flight Intent)', {
    raw: estimateTokens(naiveRecall), opt: estimateTokens(groundingProbe), provenance: MEASURED,
    source: 'live ICM store', details: 'O(1) deterministic grounding vs semantic recall',
  })
  console.log(`  ✓ Phase 0 complete: ${p0.rawTokens} tokens -> ${p0.optimizedTokens} tokens (${p0.percentSaved} saved) [real]\n`)
} else {
  ledger.record('Phase_0_Frame', '/sdd-frame (Pre-Flight Intent)', {
    raw: 0, opt: 0, provenance: SKIPPED, details: 'icm CLI unavailable — no invented baseline',
  })
  console.log('  – Phase 0 skipped: icm CLI unavailable, refusing to invent a baseline\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 1: /sdd-new — Explore & Relevance Contrast
// ─────────────────────────────────────────────────────────────────────────────
console.log('▶ [Fase 1: /sdd-new] Testing Calibrated Relevance-Contrast Context Arranger...')
const signalItems = Array.from({ length: 10 }, (_, i) => ({ id: `sig-${i}`, content: 'Critical service signature and interface constraint block '.repeat(5) }))
const bgItems = Array.from({ length: 20 }, (_, i) => ({ id: `bg-${i}`, content: 'Unrelated background workspace context and obsolete historical log '.repeat(5) }))

// Raw context: All 30 items dumped into prompt
const rawNewChars = [...signalItems, ...bgItems].reduce((acc, item) => acc + item.content.length, 0)
const rawNewTokens = Math.round(rawNewChars / 4)

// AOI Arranged context: 50:50 ratio calibrated window capped at maxItems=8
const arranged = arrangeContext({ signalItems, backgroundItems: bgItems, targetRatio: 0.5, maxItems: 8 })
const optNewChars = arranged.reduce((acc, item) => acc + item.content.length, 0)
const optNewTokens = Math.round(optNewChars / 4)

const p1 = ledger.record('Phase_1_New', '/sdd-new (Explore & Discovery)', {
  raw: rawNewTokens, opt: optNewTokens, provenance: FIXTURE, source: '30 synthetic discovery items',
  details: 'Saving comes from the maxItems=8 window cap, not from reordering',
})
console.log(`  ✓ Phase 1 complete: ${p1.rawTokens} tokens -> ${p1.optimizedTokens} tokens (${p1.percentSaved} saved) [fixture]\n`)

// ─────────────────────────────────────────────────────────────────────────────
// FASE 2: /sdd-ff — Specify & Plan (TOON Payload Serialization)
// ─────────────────────────────────────────────────────────────────────────────
console.log('▶ [Fase 2: /sdd-ff] Testing TOON vs Raw Markdown Task Payload...')
const complexTasksMd = `
### Task T-1: Implement evaluateFiberHealth function
- Status: Pending
- Role: [backend]
- TDD Requirements: Write failing test in fiber-health.test.ts, then implement in fiber-health.ts with Ratio calculation
### Task T-2: Implement health metrics route handler
- Status: Pending
- Role: [backend]
- TDD Requirements: Write test in fibers.test.ts, implement server/api/fibers.get.ts
### Task T-3: Implement dashboard UI health badge
- Status: Pending
- Role: [frontend]
- UI Requirements: Render green/yellow/red badge according to FiberStatus
`
const complexDesignMd = `
## Contracts
\`\`\`typescript
export type FiberStatus = 'stable' | 'degraded' | 'critical'
export interface FiberHealthResult { healthScore: number; status: FiberStatus }
export function evaluateFiberHealth(active: number, failed: number): FiberHealthResult
\`\`\`
`
// Prefer a genuine task's artifacts; fall back to the inline fixture.
const ffTasksMd = REAL_TASK_DIR ? readIfPresent(path.join(REAL_TASK_DIR, 'tasks.md')) : ''
const ffDesignMd = REAL_TASK_DIR ? readIfPresent(path.join(REAL_TASK_DIR, 'design.md')) : ''
const usingRealFf = Boolean(ffTasksMd.trim() && ffDesignMd.trim())
const ffPayloadArgs = {
  taskId: usingRealFf ? path.basename(REAL_TASK_DIR) : 'TASK-2026-STRESS',
  role: 'backend',
  tasksMd: usingRealFf ? ffTasksMd : complexTasksMd,
  designMd: usingRealFf ? ffDesignMd : complexDesignMd,
}
const rawPayload = buildSubagentPayload({ ...ffPayloadArgs, format: 'markdown' })
const toonPayload = buildSubagentPayload({ ...ffPayloadArgs, format: 'toon' })

const p2 = ledger.record('Phase_2_FF', '/sdd-ff (Specify & Plan)', {
  raw: estimateTokens(rawPayload.payload), opt: estimateTokens(toonPayload.payload),
  provenance: usingRealFf ? MEASURED : FIXTURE,
  source: usingRealFf ? path.relative(process.cwd(), REAL_TASK_DIR) : 'inline fixture',
  details: 'TOON tabular envelope vs Markdown on the real subagent payload',
})
console.log(`  ✓ Phase 2 complete: ${p2.rawTokens} tokens -> ${p2.optimizedTokens} tokens (${p2.percentSaved} saved) [${usingRealFf ? 'real' : 'fixture'}]\n`)

// ─────────────────────────────────────────────────────────────────────────────
// FASE 3: /sdd-apply — Implement (AST-Lens + Scaffolding + Tombstoning)
// ─────────────────────────────────────────────────────────────────────────────
console.log('▶ [Fase 3: /sdd-apply] Stress testing AST-Lens, Zero-Token Scaffolding, and Context Tombstoning...')
// Stress 3.1: AST-Lens on multiple real files
const file1 = fs.readFileSync('scripts/spatiotemporal-runtime/coeffect-resolver.mjs', 'utf8')
const file2 = fs.readFileSync('aoi_apps/agentic-ops-dashboard/server/utils/resource-operations.ts', 'utf8')
const skel1 = skeletonizeCode(file1)
const skel2 = skeletonizeCode(file2)

const rawReadTokens = Math.round((file1.length + file2.length) / 4)
const optReadTokens = Math.round((skel1.length + skel2.length) / 4)

// Stress 3.2: Scaffolding Synthesizer
const tempTaskDir = '.tasks/stress-test-task'
fs.mkdirSync(tempTaskDir, { recursive: true })
fs.writeFileSync(path.join(tempTaskDir, 'spec.md'), '### Scenario: Health calculation\nGiven 10 active\nThen status stable\n')
fs.writeFileSync(path.join(tempTaskDir, 'design.md'), '```typescript\nexport function calculateHealth(a: number): number\n```\n')
const synthRes = scaffoldTaskFromSpecs(tempTaskDir)
// Measured, not assumed: the raw baseline is exactly the content an LLM would
// have had to EMIT. AOI generates the same bytes mechanically, so 0 inference.
const scaffoldOutput = `${synthRes.implementationStub}\n${synthRes.testSuite}`
const rawScaffoldOutputTokens = estimateTokens(scaffoldOutput)
const optScaffoldOutputTokens = 0

// Stress 3.3: Context Tombstoning over a 5-turn stress debugging sequence
const stressTurns = [
  { id: '1', turnNumber: 1, tool: 'test', summary: 'RED test failed (AssertionError in evaluateFiberHealth)', content: 'Stack trace with 80 lines: '.repeat(20) },
  { id: '2', turnNumber: 2, tool: 'edit_file', target: 'fiber-health.ts', content: 'partial patch' },
  { id: '3', turnNumber: 3, tool: 'test', summary: 'Type error TS2322 in FiberStatus assignment', content: 'Stack trace with 60 lines: '.repeat(15) },
  { id: '4', turnNumber: 4, tool: 'edit_file', target: 'fiber-health.ts', content: 'type fix' },
  { id: '5', turnNumber: 5, tool: 'test', summary: 'GREEN test passed (100% OK)', content: '1 passed in 2ms' }
]
const shrunkTurns = shrinkTurns(stressTurns)
const rawTurnsChars = stressTurns.reduce((acc, t) => acc + t.content.length, 0)
const optTurnsChars = shrunkTurns.reduce((acc, t) => acc + t.content.length, 0)
const rawTurnsTokens = Math.round(rawTurnsChars / 4)
const optTurnsTokens = Math.round(optTurnsChars / 4)

fs.rmSync(tempTaskDir, { recursive: true, force: true })

const rawApplyTotal = rawReadTokens + rawScaffoldOutputTokens + rawTurnsTokens
const optApplyTotal = optReadTokens + optScaffoldOutputTokens + optTurnsTokens
// Composite provenance is only as strong as its weakest input: AST-Lens and the
// scaffolder run on real content, the tombstoning turns are still synthetic.
const p3 = ledger.record('Phase_3_Apply', '/sdd-apply (Implement & TDD)', {
  raw: rawApplyTotal, opt: optApplyTotal, provenance: FIXTURE,
  source: 'AST-Lens: real files · scaffolder: real output · tombstoning: synthetic turns',
  details: 'AST-Lens + Zero-Token Scaffolding + Context Tombstoning',
})
console.log(`  ✓ Phase 3 complete: ${p3.rawTokens} tokens -> ${p3.optimizedTokens} tokens (${p3.percentSaved} saved) [mixed]\n`)

// ─────────────────────────────────────────────────────────────────────────────
// FASE 4: /sdd-verify — Verify & QA (Mechanical Set Union, Distiller, Rollback)
// ─────────────────────────────────────────────────────────────────────────────
console.log('▶ [Fase 4: /sdd-verify] Stress testing Mechanical Union, Diagnostic Distiller, and Rollback...')

// Stress 4.1: Diagnostic Distiller on massive vitest and tsc crash
const rawCrash = `
RUN v4.1.7 /Users/equinox/Desktop/AOI TESTS
FAIL test/server/fiber-health.test.ts
  AssertionError: expected 'stable' to equal 'degraded'
    at evaluateFiberHealth (server/utils/fiber-health.ts:15:9)
    at runTest (node_modules/vitest/dist/runner.js:12:3)
    at runSuite (node_modules/vitest/dist/runner.js:45:9)
    at node_modules/vitest/dist/chunk-runtime.js:120:15
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at node:internal/main/run_main_module:17:47
Test Files 1 failed (1)
Duration 350ms
`
const distilledCrash = distillTestOutput(rawCrash)
const rawCrashTokens = Math.round(rawCrash.length / 4)
const optCrashTokens = Math.round(distilledCrash.length / 4)

// Stress 4.2: Mechanical Set Union consolidating 4 simultaneous defect reports in 0 tokens
const r1 = { source: 'vitest', failedTests: ['evaluateFiberHealth: should be stable'] }
const r2 = { source: 'tsc', typeErrors: ['server/utils/fiber-health.ts:TS2322'] }
const r3 = { source: 'linter', lintErrors: ['no-unused-vars:server/utils/fiber-health.ts:5'] }
const r4 = { source: 'srp-guard', contractViolations: ['File > 300 LOC: none'] }
const unified = unifyVerificationReports([r1, r2, r3, r4])
// Measured, not assumed. Raw = what an LLM fuser must ingest (the four reports)
// plus what it must emit (the summary). AOI = only the summary enters context,
// produced deterministically, so the four raw reports are never read at all.
const fuserInput = JSON.stringify([r1, r2, r3, r4])
const fuserOutput = formatUnifiedVerificationReport(unified)
const rawVerifyFuserTokens = estimateTokens(fuserInput) + estimateTokens(fuserOutput)
const optVerifyFuserTokens = estimateTokens(fuserOutput)

// Stress 4.3: Spatiotemporal Rollback Validation (Testing exact byte-level recovery)
const sandbox = createSubagentSandbox({ role: 'backend', taskDir: '.tasks/fiber-health/TASK-2026-003' })
const canaryFile = 'aoi_apps/agentic-ops-dashboard/server/utils/canary-test.ts'
sandbox.trackFileWrite(canaryFile, 'export const canary = "mutated";')
if (!fs.existsSync(canaryFile)) throw new Error('Sandbox write failed')
sandbox.rollback()
const rollbackSuccess = !fs.existsSync(canaryFile)
if (!rollbackSuccess) throw new Error('Sandbox rollback failed')

const rawVerifyTotal = rawCrashTokens + rawVerifyFuserTokens
const optVerifyTotal = optCrashTokens + optVerifyFuserTokens
const p4 = ledger.record('Phase_4_Verify', '/sdd-verify (Verification & QA)', {
  raw: rawVerifyTotal, opt: optVerifyTotal, provenance: FIXTURE,
  source: 'union: real serialization · distiller: synthetic crash · rollback: real side effect',
  details: 'Mechanical Set Union (0 inference) + Diagnostic Distiller + 0-Token Fiber Rollback',
})
console.log(`  ✓ Phase 4 complete: ${p4.rawTokens} tokens -> ${p4.optimizedTokens} tokens (${p4.percentSaved} saved) [mixed]\n`)

// ─────────────────────────────────────────────────────────────────────────────
// FASE 5: /sdd-archive — Archive & Cognitive Distillation
// ─────────────────────────────────────────────────────────────────────────────
console.log('▶ [Fase 5: /sdd-archive] Testing Archive & Registry Closure...')
if (REAL_TASK_DIR) {
  // Raw: the closure the model would draft after re-reading every artifact.
  // AOI: an atomic registry line plus a dense ICM checkpoint.
  const artifacts = ['spec.md', 'design.md', 'tasks.md', 'verify-report.md', 'proposal.md']
    .map((name) => readIfPresent(path.join(REAL_TASK_DIR, name)))
    .join('\n')
  const taskId = path.basename(REAL_TASK_DIR)
  const closure =
    `| ${taskId} | 📦 Archivado | ${new Date().toISOString().slice(0, 10)} |\n` +
    `ARCHIVED: ${taskId}. See ${path.relative(process.cwd(), REAL_TASK_DIR)}/archive-report.md`
  const p5 = ledger.record('Phase_5_Archive', '/sdd-archive (Closure & Distillation)', {
    raw: estimateTokens(artifacts), opt: estimateTokens(closure), provenance: MEASURED,
    source: path.relative(process.cwd(), REAL_TASK_DIR),
    details: 'Atomic registry update + dense ICM checkpoint vs re-reading every artifact',
  })
  console.log(`  ✓ Phase 5 complete: ${p5.rawTokens} tokens -> ${p5.optimizedTokens} tokens (${p5.percentSaved} saved) [real]\n`)
} else {
  ledger.record('Phase_5_Archive', '/sdd-archive (Closure & Distillation)', {
    raw: 0, opt: 0, provenance: SKIPPED, details: 'no completed task in .tasks/ — no invented baseline',
  })
  console.log('  – Phase 5 skipped: no real task artifacts to measure\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT CACHE INVARIANCE STRESS AUDIT
// ─────────────────────────────────────────────────────────────────────────────
console.log('▶ [Cache-Guard] Auditing Prompt Prefix Cache Invariance...')
const cacheReport = auditPromptsDirectory('.github/prompts')
console.log(`  ✓ Scanned ${cacheReport.scanned} prompt templates: ${cacheReport.passed} passed, ${cacheReport.failed} violations`)
if (cacheReport.failed > 0) throw new Error('Cache-Guard failed')

console.log('\n═══════════════════════════════════════════════════════════════════════════════')
console.log('                  RESUMEN EJECUTIVO DE TELEMETRÍA END-TO-END                  ')
console.log('═══════════════════════════════════════════════════════════════════════════════')
console.table(toTableRows(ledger))
console.log(formatTotals(ledger))
console.log('═══════════════════════════════════════════════════════════════════════════════\n')
