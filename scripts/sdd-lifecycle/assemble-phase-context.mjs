#!/usr/bin/env node
/**
 * scripts/sdd-lifecycle/assemble-phase-context.mjs
 *
 * Materialises the EXACT prose a phase loads, in one string.
 *
 * The budget counts that prose; nothing ever produced it. That gap mattered
 * twice over. First, the count could drift from reality with nothing to catch
 * it — a component measured but never assembled, or assembled but never
 * measured, looks identical from the outside. Second, and the reason this
 * exists: trimming prose can only be judged by whether an agent still decides
 * correctly with what is left, and to ask that question you need the "what is
 * left" as an actual artifact, not as a number.
 *
 * Composition mirrors phaseContextCost exactly, so `assembled tokens === floor`
 * is a real cross-check between the two. Conditional and one-of branches are
 * excluded: they are not part of what every run loads.
 *
 * Zero inference tokens: it concatenates files already on disk.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { estimateTokens } from './token-accounting.mjs'
import { instructionsFor, read, skillsFor } from './instruction-scope.mjs'
import { agentGroupsIn, agentsIn, speckitIn } from './phase-references.mjs'
import { SDD_PHASES } from './context-budget.mjs'

const agentFile = (root, name) => path.join(root, `.github/agents/${name}.agent.md`)
const speckitFiles = (root, cmd) => [
  path.join(root, `.github/agents/${cmd}.agent.md`),
  path.join(root, `.github/prompts/${cmd}.prompt.md`),
]

/**
 * Builds the floor context of a phase: everything a run loads unconditionally.
 *
 * @returns {{ text: string, parts: Array<{source: string, tokens: number}> }}
 */
export function assemblePhaseContext(root, promptRel, phase = '') {
  const parts = []
  const push = (source, body) => {
    if (body) parts.push({ source, tokens: estimateTokens(body), body })
  }

  push(promptRel, read(path.join(root, promptRel)))

  const text = read(path.join(root, promptRel))
  for (const { name, conditional } of agentsIn(text)) {
    if (conditional) continue
    push(`.github/agents/${name}.agent.md`, read(agentFile(root, name)))
  }
  // Exactly one candidate of each one-of set runs; the cheapest is the floor.
  for (const group of agentGroupsIn(text)) {
    const cheapest = group
      .map((n) => ({ n, body: read(agentFile(root, n)) }))
      .sort((a, b) => estimateTokens(a.body) - estimateTokens(b.body))[0]
    if (cheapest?.body) push(`.github/agents/${cheapest.n}.agent.md`, cheapest.body)
  }
  for (const { command, conditional } of speckitIn(text)) {
    if (conditional) continue
    for (const f of speckitFiles(root, command)) push(path.relative(root, f), read(f))
  }
  for (const i of instructionsFor(root, promptRel)) push(i.file, read(path.join(root, i.file)))
  for (const s of skillsFor(root, phase)) push(s.file, read(path.join(root, s.file)))

  return {
    text: parts.map((p) => `\n\n===== ${p.source} =====\n${p.body}`).join(''),
    parts: parts.map(({ source, tokens }) => ({ source, tokens })),
  }
}

function main() {
  const root = process.cwd()
  const wanted = process.argv[2]
  const phases = wanted ? SDD_PHASES.filter(([k]) => k === wanted) : SDD_PHASES
  if (phases.length === 0) {
    console.error(`Unknown phase: ${wanted}. One of: ${SDD_PHASES.map(([k]) => k).join(', ')}`)
    process.exit(2)
  }

  for (const [key, rel] of phases) {
    const { text, parts } = assemblePhaseContext(root, rel, key)
    if (process.argv.includes('--print')) {
      process.stdout.write(text)
      continue
    }
    console.log(`${key}: ${estimateTokens(text)} tokens from ${parts.length} file(s)`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
