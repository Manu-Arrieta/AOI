/**
 * scripts/sdd-lifecycle/stress-fixtures.mjs
 *
 * Los insumos sintéticos de la stress suite, en un solo lugar.
 *
 * Este archivo no inventa una regla: la cumple. `real-corpus.mjs` ya declaraba,
 * junto a sus tres fallbacks, que se quedan ahí "para que el orquestador del
 * benchmark NUNCA lleve datos sintéticos inline". El orquestador los llevaba
 * igual — dos fixtures de payload y cuatro reportes de defecto — así que la
 * regla estaba escrita y sin cumplir.
 *
 * Y había un costo medido: `sdd-stress-suite.mjs` llegó a las 300 LOC exactas
 * del Invariante 5 con esos datos adentro, mientras `real-corpus.mjs` se
 * quedaba en 296. Los dos archivos estaban a una línea de romper la build, por
 * la misma causa: datos que no pertenecen al código que los usa.
 *
 * Los fixtures se distinguen de los datos reales por el prefijo, que es el que
 * ya usaban los tres que vivían en `real-corpus.mjs`: `fallback*` y
 * `FALLBACK_*` son sintéticos, y todo lo demás se mide del árbol.
 */

export const COMPLEX_TASKS_MD = `
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

export const COMPLEX_DESIGN_MD = `
## Contracts
\`\`\`typescript
export type FiberStatus = 'stable' | 'degraded' | 'critical'
export interface FiberHealthResult { healthScore: number; status: FiberStatus }
export function evaluateFiberHealth(active: number, failed: number): FiberHealthResult
\`\`\`
`

// Los cuatro reportes que la Fusión Mecánica consolida. Van juntos porque
// siempre se usan juntos: `unifyVerificationReports` los recibe como un lote y
// el cálculo del ahorro serializa el mismo lote.
export const DEFECT_REPORTS = [
  { source: 'vitest', failedTests: ['evaluateFiberHealth: should be stable'] },
  { source: 'tsc', typeErrors: ['server/utils/fiber-health.ts:TS2322'] },
  { source: 'linter', lintErrors: ['no-unused-vars:server/utils/fiber-health.ts:5'] },
  { source: 'srp-guard', contractViolations: ['File > 300 LOC: none'] }
]
// ── Fallbacks ──────────────────────────────────────────────────────
// Usados sólo cuando la captura real es imposible: un entorno sin árbol de
// fuentes legible, o sin runner que pueda spawnear. Los tres llegaron desde
// `real-corpus.mjs`, donde ya convivían con los constructores reales bajo la
// regla de que el orquestador no lleve datos sintéticos inline.

/** Synthetic discovery corpus, for environments with no readable source tree. */
export function fallbackDiscoveryCorpus() {
  return {
    signalItems: Array.from({ length: 10 }, (_, i) => ({
      id: `sig-${i}`, content: 'Critical service signature and interface constraint block '.repeat(5),
    })),
    backgroundItems: Array.from({ length: 20 }, (_, i) => ({
      id: `bg-${i}`, content: 'Unrelated background workspace context and obsolete historical log '.repeat(5),
    })),
    sampled: 0,
  }
}

/** Synthetic debugging sequence, for environments where the runner cannot spawn. */
export function fallbackDebuggingTurns() {
  return [
    { id: '1', turnNumber: 1, tool: 'test', summary: 'RED test failed', content: 'Stack trace with 80 lines: '.repeat(20) },
    { id: '2', turnNumber: 2, tool: 'edit_file', target: 'fiber-health.ts', content: 'partial patch' },
    { id: '3', turnNumber: 3, tool: 'test', summary: 'Type error TS2322', content: 'Stack trace with 60 lines: '.repeat(15) },
    { id: '4', turnNumber: 4, tool: 'edit_file', target: 'fiber-health.ts', content: 'type fix' },
    { id: '5', turnNumber: 5, tool: 'test', summary: 'GREEN test passed', content: '1 passed in 2ms' },
  ]
}

/** Synthetic runner crash, for environments where the runner cannot spawn. */
export const FALLBACK_CRASH = [
  'RUN v4.1.7',
  'FAIL test/server/fiber-health.test.ts',
  "  AssertionError: expected 'stable' to equal 'degraded'",
  '    at evaluateFiberHealth (server/utils/fiber-health.ts:15:9)',
  '    at runTest (node_modules/vitest/dist/runner.js:12:3)',
  'Test Files 1 failed (1)',
].join('\n')
