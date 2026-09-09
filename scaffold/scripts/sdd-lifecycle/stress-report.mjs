/**
 * scripts/sdd-lifecycle/stress-report.mjs
 *
 * Renders the executive summary of the stress suite.
 *
 * Split out of sdd-stress-suite.mjs when adding the cache-prefix block pushed
 * that file past the 300 LOC of Invariant 5. The boundary is not arbitrary:
 * the suite MEASURES — it runs the optimizers over real artifacts and fills a
 * ledger — while everything here only READS what has already been decided and
 * arranges it for a human. Each new instrument was adding a console block to a
 * file whose job is measurement, and that is how a measurement file turns into
 * a report file one paragraph at a time.
 *
 * Four instruments print here, and they answer four different questions:
 * the ledger says how well the variable payload compresses, the budget says
 * what a cycle costs before any work happens, the cache report says how much
 * of that cost is the same bytes paid again, and the handoff chain says
 * whether what one phase produces is what the next can consume.
 */

import { auditContextBudget, formatBudgetSummary, toBudgetRows } from './context-budget.mjs'
import { formatCacheReport, partitionSurface, surfaceDigest, surfaceLoadMap } from './cache-prefix.mjs'
import { formatHandoffChain } from './phase-handoffs.mjs'
import { formatTotals, toTableRows } from './token-accounting.mjs'

const RULE = '═'.repeat(79)
const THIN = '─'.repeat(79)

/** Prints every instrument's verdict, in the order a reader needs them. */
export function printExecutiveSummary(root, ledger) {
  console.log(`\n${RULE}`)
  console.log('                  RESUMEN EJECUTIVO DE TELEMETRÍA END-TO-END                  ')
  console.log(RULE)
  console.table(toTableRows(ledger))
  console.log(formatTotals(ledger))

  console.log(`\n${THIN}`)
  const budget = auditContextBudget(root)
  console.table(toBudgetRows(budget))
  console.log(formatBudgetSummary(budget, ledger.totals.optimizedTokens))

  console.log(`\n${THIN}`)
  const surface = partitionSurface(surfaceLoadMap(root))
  console.log(formatCacheReport(surface))
  console.log(`\nHuella de la masa repetida: ${surfaceDigest(root, surface.universal)}`)

  console.log('\nCADENA DE TRASPASO ENTRE FASES (verificada por pnpm aoi:handoffs):')
  console.log(formatHandoffChain())
  console.log(`${RULE}\n`)
}
