#!/usr/bin/env node
/**
 * scripts/sdd-lifecycle/phase-handoffs.mjs
 *
 * Verifies that what one phase produces is what the next one can consume.
 *
 * The behavioural eval checks decisions INSIDE a phase. It cannot see the
 * failure that only appears between two: a phase that requires `design.md`
 * while no earlier phase ever writes it, or a producer that renames an
 * artifact its consumer still asks for by the old name. That break is silent
 * — each prompt reads perfectly on its own — and it only surfaces mid-cycle,
 * when the work to that point is already spent.
 *
 * Running a real cycle would also find it, at the price of six phases of
 * inference. This finds it by reading the prompts: every required artifact
 * must be produced by an earlier phase, every declared producer must actually
 * say it writes the file, and every consumer must actually say it reads it.
 * Zero inference tokens, and it runs inside `pnpm test`.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PROMPT = (name) => `.github/prompts/${name}.prompt.md`

/**
 * The artifact contract of each phase, in lifecycle order.
 *
 * `produces` is what the phase writes for someone downstream. `requires` is
 * what it needs from upstream and cannot proceed without. Optional inputs are
 * deliberately absent: an artifact listed here is a hard dependency, and the
 * checker treats a missing producer as a broken chain.
 */
export const HANDOFFS = [
  {
    phase: 'Phase_0_Frame',
    prompt: PROMPT('sdd-frame'),
    // Zero-Task Footprint: the only thing that crosses to the next phase is
    // the contract itself, persisted as O(1) facts rather than as a file.
    produces: ['bic-facts'],
    requires: [],
  },
  {
    phase: 'Phase_1_New',
    prompt: PROMPT('sdd-new'),
    produces: ['proposal.md', 'registry.md'],
    requires: [],
  },
  {
    phase: 'Phase_2_FF',
    prompt: PROMPT('sdd-ff'),
    produces: ['spec.md', 'design.md', 'tasks.md', 'implementation-plan.md'],
    requires: ['proposal.md'],
  },
  {
    phase: 'Phase_3_Apply',
    prompt: PROMPT('sdd-apply'),
    produces: [],
    requires: ['spec.md', 'design.md', 'tasks.md', 'implementation-plan.md'],
  },
  {
    phase: 'Phase_4_Verify',
    prompt: PROMPT('sdd-verify'),
    produces: ['verify-report.md'],
    // The Invariant Gate reads the contract the Pre-Flight persisted, which is
    // the one handoff that travels through ICM instead of through disk.
    requires: ['spec.md', 'design.md', 'tasks.md', 'bic-facts'],
  },
  {
    phase: 'Phase_5_Archive',
    prompt: PROMPT('sdd-archive'),
    produces: ['archive-report.md', 'functional-docs.md'],
    requires: ['verify-report.md'],
  },
]

/** How an artifact is recognised inside a prompt. */
function mentions(text, artifact) {
  if (artifact === 'bic-facts') return /bic\.|icm facts/i.test(text)
  return text.includes(artifact)
}

/**
 * Audits the chain.
 *
 * @returns {{ orphanRequires: string[], silentProducers: string[], silentConsumers: string[] }}
 */
export function auditHandoffs(root, chain = HANDOFFS) {
  const orphanRequires = []
  const silentProducers = []
  const silentConsumers = []
  const producedSoFar = new Set()

  for (const step of chain) {
    let text = ''
    try {
      text = fs.readFileSync(path.join(root, step.prompt), 'utf8')
    } catch {
      orphanRequires.push(`${step.phase}: prompt no encontrado (${step.prompt})`)
      continue
    }

    for (const artifact of step.requires) {
      if (!producedSoFar.has(artifact)) {
        orphanRequires.push(`${step.phase} requiere ${artifact}, que ninguna fase anterior produce`)
      }
      if (!mentions(text, artifact)) {
        silentConsumers.push(`${step.phase} declara requerir ${artifact} pero su prompt no lo nombra`)
      }
    }
    for (const artifact of step.produces) {
      if (!mentions(text, artifact)) {
        silentProducers.push(`${step.phase} declara producir ${artifact} pero su prompt no lo nombra`)
      }
      producedSoFar.add(artifact)
    }
  }

  return { orphanRequires, silentProducers, silentConsumers }
}

/** One line per phase, for the benchmark report. */
export function formatHandoffChain(chain = HANDOFFS) {
  return chain
    .map((s) => {
      const inp = s.requires.length ? s.requires.join(', ') : '—'
      const out = s.produces.length ? s.produces.join(', ') : '—'
      return `  ${s.phase.padEnd(17)} ← ${inp.padEnd(52)} → ${out}`
    })
    .join('\n')
}

function main() {
  const root = process.cwd()
  const r = auditHandoffs(root)

  console.log('=== AOI Phase Handoff Contract ===')
  console.log(formatHandoffChain())

  const failures = [...r.orphanRequires, ...r.silentProducers, ...r.silentConsumers]
  if (failures.length > 0) {
    console.error('')
    for (const f of failures) console.error(`❌ ${f}`)
    console.error('\nUna cadena rota solo se nota a mitad del ciclo, con el trabajo previo ya gastado.')
    process.exit(1)
  }
  console.log('\n✅ Cada artefacto exigido lo produce una fase anterior, y ambos prompts lo nombran.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
