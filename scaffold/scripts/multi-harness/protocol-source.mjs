/**
 * scripts/multi-harness/protocol-source.mjs
 *
 * Reads the canonical ICM protocol so the harness files can be DERIVED from it
 * instead of carrying copies.
 *
 * Split out of compile-rules.mjs when that file crossed the 300 LOC of
 * Invariant 5, and the boundary is a real one: reading the single source of
 * truth is a different job from rendering six harness dialects out of it.
 *
 * The problem this exists to end: compile-rules said it compiled "from
 * .github/instructions/" and never opened the directory. Every generator held
 * its own hardcoded copy of the store-trigger rules, and the copies had
 * already drifted — the generated CLAUDE.md told agents to file an
 * architecture decision as `high` while the protocol said `critical`. Both
 * surfaces are always in context, so an agent read that contradiction on every
 * single task, and no gate could see it because `pnpm aoi:sync-rules` printed
 * "compiled successfully" without reading the file it claimed to compile.
 */

import fs from 'node:fs'
import path from 'node:path'

/** The canonical source compile-rules' docstring has always named. */
export const ICM_PROTOCOL = '.github/instructions/icm-protocol.instructions.md'

/**
 * Skills whose canonical text is an instruction file, not the skill itself.
 *
 * `.github/instructions/` reaches the orchestrator (via `applyTo`) and every
 * subagent (as Project Standards), but never antigravity. So a rule needed by
 * all three used to be written twice, and the orchestrator paid for both
 * copies in all six phases. Listing the pair here lets the skill shrink to its
 * trigger while antigravity still receives the full text, derived.
 */
export const SKILL_FROM_INSTRUCTION = {
  rtk: 'rtk.instructions.md',
}

/**
 * Builds the antigravity copy of a skill out of its canonical instruction.
 *
 * @returns {string|null} null when the skill has no canonical instruction
 */
export function deriveSkillFromInstruction(repoRoot, skillName, dir = '.github/instructions') {
  const source = SKILL_FROM_INSTRUCTION[skillName]
  if (!source) return null

  let text
  try {
    text = fs.readFileSync(path.join(repoRoot, dir, source), 'utf8')
  } catch {
    return null
  }

  // The instruction's front matter carries `applyTo`, which means nothing to a
  // skill loader; the skill's own front matter carries the trigger that does.
  const body = text.replace(/^---\n[\s\S]*?\n---\n/, '').trim()
  const trigger = SKILL_TRIGGERS[skillName] ?? `Use when working with ${skillName}.`

  return `---
name: ${skillName}
description: ${trigger}
---

<!-- Derivado de ${dir}/${source} por aoi:sync-rules. No editar a mano. -->

${body}
`
}

/** The `description` line each derived skill announces itself with. */
export const SKILL_TRIGGERS = {
  rtk: 'RTK CLI proxy for token-optimized command output. Prefix all shell commands with `rtk` to save 60-90% tokens. Use when running terminal commands — builds, tests, git operations, file searches.',
}

/**
 * The importance level each store trigger must use, read from the protocol.
 *
 * Parsing is deliberately narrow: only the `* level → cases` bullets under
 * "Store triggers", stopping at the next section. A missing or unreadable
 * protocol yields an empty map so the caller can fall back to its previous
 * wording — a parse failure should degrade to the old behaviour, never emit
 * rules with holes in them.
 *
 * @returns {Record<string, string>} importance level -> the cases it covers
 */
export function readStoreTriggers(repoRoot) {
  let text = ''
  try {
    text = fs.readFileSync(path.join(repoRoot, ICM_PROTOCOL), 'utf8')
  } catch {
    return {}
  }

  const section = text.split(/\*\*Store triggers\*\*/)[1]
  if (!section) return {}

  const levels = {}
  for (const line of section.split('\n')) {
    if (/^\s*\*\*Non-store/.test(line)) break
    const m = /^\s*\*\s+`(\w+)`\s*→\s*(.+?)\s*$/.exec(line)
    if (m) levels[m[1]] = m[2]
  }
  return levels
}

/**
 * Renders the store-trigger block every harness file carries.
 *
 * @param {Record<string,string>} levels from readStoreTriggers
 * @param {string} workspace
 * @returns {string} '' when the protocol could not be read
 */
export function renderStoreTriggers(levels, workspace) {
  const order = ['critical', 'high', 'medium', 'low']
  const present = order.filter((l) => levels[l])
  if (present.length === 0) return ''

  return [
    `### Store Triggers (MANDATORY) — derivado de \`${ICM_PROTOCOL}\``,
    '',
    `\`icm store -t <topic> -c "<description>" -i <importance>\` · topics: \`decisions-${workspace}\`,`,
    `\`context-${workspace}\`, \`errors-resolved\`, \`preferences\`.`,
    '',
    ...present.map((l) => `- \`-i ${l}\` → ${levels[l]}`),
    '',
    `Configuración exacta como hecho O(1): \`icm facts set "${workspace}" "key" "value"\`.`,
  ].join('\n')
}
