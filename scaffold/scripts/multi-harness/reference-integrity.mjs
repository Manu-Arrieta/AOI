/**
 * scripts/multi-harness/reference-integrity.mjs
 *
 * Deterministic linter for the agentic prose surface.
 *
 * Prompts, agent files, instructions and skills are NOT documentation — they
 * are executable instructions handed to an LLM. Every script path, slash
 * command, @agent handle and MCP tool name written in that prose is a live
 * reference, but nothing ever executes the prose, so a wrong name rots in
 * silence: no test fails, scaffold parity still passes, aoi:doctor stays
 * green, and the agent only discovers it at runtime — where it usually
 * shrugs and continues.
 *
 * This linter closes that gap mechanically, at 0 LLM inference tokens.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/**
 * MCP tools exposed by the ICM server. A name in prose that is absent here is
 * a phantom tool. Refresh this list when ICM ships new tools.
 */
export const ICM_MCP_TOOLS = new Set([
  'icm_feedback_record', 'icm_feedback_search', 'icm_feedback_stats', 'icm_learn',
  'icm_memoir_add_concept', 'icm_memoir_create', 'icm_memoir_export', 'icm_memoir_inspect',
  'icm_memoir_link', 'icm_memoir_list', 'icm_memoir_refine', 'icm_memoir_search',
  'icm_memoir_search_all', 'icm_memoir_show', 'icm_memory_consolidate', 'icm_memory_embed_all',
  'icm_memory_extract_patterns', 'icm_memory_forget', 'icm_memory_forget_topic',
  'icm_memory_health', 'icm_memory_list_topics', 'icm_memory_recall', 'icm_memory_stats',
  'icm_memory_store', 'icm_memory_update', 'icm_transcript_record', 'icm_transcript_search',
  'icm_transcript_show', 'icm_transcript_start_session', 'icm_transcript_stats', 'icm_wake_up',
])

/**
 * Executable prose: everything named here is meant to be invoked by an agent,
 * so every reference must resolve.
 */
export const PROSE_DIRS = [
  '.github/prompts',
  '.github/agents',
  '.github/instructions',
  '.github/skills',
  '.agents/skills',
  '.agents/rules',
  // The constitution names commands and scripts and governs the whole
  // lifecycle, so a broken reference there is the most expensive kind.
  '.specify/memory',
  '.github/copilot-instructions.md',
]

/**
 * Narrative prose: explanatory docs that legitimately use illustrative
 * shorthand (`@backend` for @backend-developer), npm scopes (`@scope/pkg`) and
 * the MCP gateway's compressed tool names (`icm_store`), none of which resolve
 * to a file. Only unambiguous references are checked here: script paths and
 * slash commands, which have no shorthand convention.
 */
export const NARRATIVE_DIRS = ['docs', 'wiki']

const SCRIPT_REF = /node\s+(scripts\/[A-Za-z0-9/_.-]+\.mjs)/g
const COMMAND_REF = /(?:^|[\s(`"])\/((?:sdd-|speckit\.)[a-z0-9-]+(?:\.[a-z0-9-]+)*)/g
const AGENT_REF = /(?:^|[^\w.@])@([a-z][a-z0-9.-]*[a-z0-9])/g
const MCP_REF = /\b(icm_[a-z_]+)\b/g

/** Collects markdown files under the given directories, relative to root. */
export function collectProseFiles(root, dirs = PROSE_DIRS) {
  const files = []
  for (const dir of dirs) {
    const full = path.join(root, dir)
    if (!fs.existsSync(full)) continue
    // An entry may name a single file (copilot-instructions.md) rather than a
    // directory; readdirSync would throw ENOTDIR on it.
    if (!fs.statSync(full).isDirectory()) {
      if (full.endsWith('.md')) files.push(path.relative(root, full))
      continue
    }
    const walk = (current) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const p = path.join(current, entry.name)
        if (entry.isDirectory()) walk(p)
        else if (entry.name.endsWith('.md')) files.push(path.relative(root, p))
      }
    }
    walk(full)
  }
  return files.sort()
}

/** Extracts every distinct match of a global regex's first capture group. */
function extract(text, pattern) {
  const found = new Set()
  for (const m of text.matchAll(pattern)) found.add(m[1])
  return found
}

/**
 * Detects repeated ordinals inside a contiguous numbered list. Catches the
 * classic "1. 2. 3. 4. 5. 5. 6." slip introduced when inserting a step.
 *
 * @param {string} text
 * @returns {string[]} human-readable descriptions of each duplicate
 */
export function findDuplicateStepNumbers(text = '') {
  const issues = []
  let block = new Map()

  const flush = () => {
    // `1. 1. 1.` is lazy Markdown numbering (the renderer renumbers it) — only a
    // list that genuinely counts upward can carry a meaningful duplicate.
    const countsUpward = [...block.keys()].some((n) => n > 1)
    if (countsUpward) {
      for (const [n, count] of block) {
        if (count > 1) issues.push(`step "${n}." appears ${count} times in one numbered list`)
      }
    }
    block = new Map()
  }

  for (const line of String(text).split('\n')) {
    const m = line.match(/^(\d+)\.\s+\S/)
    if (m) {
      const n = Number(m[1])
      block.set(n, (block.get(n) || 0) + 1)
    } else if (!line.trim() || /^\s/.test(line)) {
      // Blank lines and indented continuations stay inside the same list.
      continue
    } else {
      flush()
    }
  }
  flush()
  return issues
}

/**
 * Validates every executable reference inside one prose file.
 *
 * @param {string} root Repository root.
 * @param {string} relPath File to audit, relative to root.
 * @returns {Array<{ file: string, kind: string, ref: string, detail: string }>}
 */
export function auditFile(root, relPath, mode = 'executable') {
  const problems = []
  let text
  try {
    text = fs.readFileSync(path.join(root, relPath), 'utf8')
  } catch {
    return problems
  }

  const add = (kind, ref, detail) => problems.push({ file: relPath, kind, ref, detail })

  for (const ref of extract(text, SCRIPT_REF)) {
    if (!fs.existsSync(path.join(root, ref))) add('script', ref, 'script file does not exist')
  }

  for (const ref of extract(text, COMMAND_REF)) {
    if (!fs.existsSync(path.join(root, '.github/prompts', `${ref}.prompt.md`))) {
      add('command', `/${ref}`, 'no matching .github/prompts/*.prompt.md')
    }
  }

  if (mode === 'narrative') return problems

  for (const ref of extract(text, AGENT_REF)) {
    if (!fs.existsSync(path.join(root, '.github/agents', `${ref}.agent.md`))) {
      add('agent', `@${ref}`, 'no matching .github/agents/*.agent.md')
    }
  }

  for (const ref of extract(text, MCP_REF)) {
    if (!ICM_MCP_TOOLS.has(ref)) add('mcp-tool', ref, 'not an ICM MCP tool')
  }

  for (const issue of findDuplicateStepNumbers(text)) {
    add('step-numbering', issue, 'duplicate ordinal breaks the documented order')
  }

  return problems
}

/**
 * Audits the whole prose surface.
 * @returns {{ status: 'PASSED'|'FAILED', filesScanned: number, problems: Array }}
 */
export function auditReferenceIntegrity(root, dirs = PROSE_DIRS, narrativeDirs = NARRATIVE_DIRS) {
  const executable = collectProseFiles(root, dirs)
  const narrative = collectProseFiles(root, narrativeDirs)
  const problems = [
    ...executable.flatMap((f) => auditFile(root, f, 'executable')),
    ...narrative.flatMap((f) => auditFile(root, f, 'narrative')),
  ]
  return {
    status: problems.length === 0 ? 'PASSED' : 'FAILED',
    filesScanned: executable.length + narrative.length,
    problems,
  }
}

/** Formats the audit as a compact report. */
export function formatReport(audit) {
  const lines = [`=== AOI Prose Reference Integrity ===`, `Scanned: ${audit.filesScanned} files`]
  if (audit.status === 'PASSED') {
    lines.push(`✅ Every script, command, @agent and MCP tool reference resolves.`)
    return lines.join('\n')
  }
  lines.push(`❌ ${audit.problems.length} broken reference(s):`, '')
  for (const p of audit.problems) {
    lines.push(`  ${p.file}`)
    lines.push(`    [${p.kind}] ${p.ref} — ${p.detail}`)
  }
  return lines.join('\n')
}

export async function main() {
  const root = process.argv[2] || process.cwd()
  const audit = auditReferenceIntegrity(root)
  process.stdout.write(formatReport(audit) + '\n')

  // "Every reference resolves" over zero files scanned is not a pass; it is a
  // gate that found nothing to check and said everything is fine. A wrong
  // working directory, or a `.github/` that a bad merge emptied, would both
  // print the checkmark.
  if (audit.filesScanned === 0) {
    process.stderr.write('\n❌ Cero archivos escaneados: no hay referencias que verificar.\n')
    process.stderr.write('Un veredicto afirmativo sobre cero entradas no dice que todo resuelve.\n')
    process.exit(1)
  }

  if (audit.status !== 'PASSED') process.exit(1)
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) main()
