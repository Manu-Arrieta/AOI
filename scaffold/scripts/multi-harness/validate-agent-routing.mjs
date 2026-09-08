#!/usr/bin/env node
/**
 * scripts/multi-harness/validate-agent-routing.mjs
 *
 * Guarantees that every agent is routable.
 *
 * The agent registry in `agent-delegation.instructions.md` is not documentation
 * about the routing — it IS the routing. It maps each agent to the model
 * parameter `runSubagent` must be called with, to its NVIDIA NIM fallback, and
 * to the file that defines it. An agent missing from that table cannot be
 * delegated to; an agent whose skill path is wrong delegates into nothing.
 *
 * The table used to exist twice, character for character, in this file and in
 * `model-selection.instructions.md`. Both are injected together into the
 * context of any `.prompt.md`, so the copy was paid in all six phases of the
 * cycle while adding no capability. Consolidating them is only safe if
 * something proves, mechanically and on every run, that no agent lost its
 * model or its fallback in the process. That is this script.
 *
 * Zero inference tokens: it reads the table and the agents directory.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const REGISTRY = '.github/instructions/agent-delegation.instructions.md'
export const AGENTS_DIR = '.github/agents'
/** Files that describe the protocol rather than an agent the registry must list. */
const NOT_AN_AGENT = new Set([])

/**
 * Parses the registry rows.
 * @returns {Map<string, {model: string, fallback: string, skill: string}>}
 */
export function parseRegistry(text) {
  const rows = new Map()
  for (const line of text.split('\n')) {
    if (!line.startsWith('| `')) continue
    const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
    if (cells.length < 4) continue
    const agent = cells[0].replace(/`/g, '').replace(/^@/, '')
    // The definition file is not listed: it is `.github/agents/<agent>.agent.md`
    // for all 27, so the column only repeated the name and was paid on every
    // injection. Deriving it here keeps the same guarantee — the existence of
    // the file is still checked — without carrying the path in the prose.
    if (!/^[a-z][a-z0-9.-]*$/.test(agent)) continue
    const model = cells[1].replace(/`/g, '')
    if (!model.includes('Provider')) continue
    rows.set(agent, {
      model,
      fallback: cells[2].replace(/`/g, ''),
      skill: `${AGENTS_DIR}/${agent}.agent.md`,
    })
  }
  return rows
}

/** Agents that actually exist on disk. */
export function listAgents(root, dir = AGENTS_DIR) {
  const full = path.join(root, dir)
  if (!fs.existsSync(full)) return []
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith('.agent.md'))
    .map((f) => f.replace(/\.agent\.md$/, ''))
    .filter((a) => !NOT_AN_AGENT.has(a))
    .sort()
}

/**
 * Audits routing integrity.
 * @returns {{ registered: number, unrouted: string[], orphanRows: string[],
 *             missingModel: string[], missingFallback: string[], badSkillPath: string[] }}
 */
export function auditAgentRouting(root) {
  const registryPath = path.join(root, REGISTRY)
  const rows = fs.existsSync(registryPath) ? parseRegistry(fs.readFileSync(registryPath, 'utf8')) : new Map()
  const agents = listAgents(root)

  const unrouted = agents.filter((a) => !rows.has(a))
  const orphanRows = [...rows.keys()].filter((a) => !agents.includes(a))
  const missingModel = []
  const missingFallback = []
  const badSkillPath = []

  for (const [agent, r] of rows) {
    if (!r.model) missingModel.push(agent)
    if (!r.fallback) missingFallback.push(agent)
    if (!fs.existsSync(path.join(root, r.skill))) badSkillPath.push(`${agent} -> ${r.skill}`)
  }

  return { registered: rows.size, unrouted, orphanRows, missingModel, missingFallback, badSkillPath }
}

function main() {
  const root = process.cwd()
  const r = auditAgentRouting(root)

  console.log('=== AOI Agent Routing Integrity ===')
  console.log(`Registry: ${r.registered} agent(s) mapped to a model, a fallback and a definition file`)

  const failures = [
    ...r.unrouted.map((a) => `UNROUTABLE      ${a} exists in ${AGENTS_DIR}/ but has no registry row`),
    ...r.orphanRows.map((a) => `STALE ROW       ${a} is registered but has no .agent.md file`),
    ...r.missingModel.map((a) => `NO MODEL        ${a} has no runSubagent model parameter`),
    ...r.missingFallback.map((a) => `NO FALLBACK     ${a} has no fallback provider`),
    ...r.badSkillPath.map((s) => `BAD SKILL PATH  ${s}`),
  ]

  if (failures.length > 0) {
    console.error('')
    for (const f of failures) console.error(`❌ ${f}`)
    console.error('\nDelegation depends on this table. A missing row is an agent that cannot be invoked.')
    process.exit(1)
  }

  console.log('✅ Every agent resolves to a model, a fallback and an existing definition.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
