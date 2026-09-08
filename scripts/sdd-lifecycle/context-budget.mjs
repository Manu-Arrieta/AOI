/**
 * scripts/sdd-lifecycle/context-budget.mjs
 *
 * Measures the FIXED cost of running an SDD phase: the prose the harness must
 * load before any work happens.
 *
 * The stress suite measures how well AOI compresses the variable payload of a
 * phase — the files explored, the diagnostics distilled, the turns tombstoned.
 * It has never measured what the phase costs just to exist: its prompt, the
 * agent definitions it delegates to, the spec-kit commands it invokes, and the
 * instruction files the harness injects because their `applyTo` glob matches.
 *
 * That omission mattered. A cycle's optimized payload is a few thousand tokens
 * while this fixed surface is an order of magnitude larger, so the headline
 * number was describing a small fraction of the real bill. Worse, prose grows
 * silently: nothing failed when a prompt gained four hundred tokens.
 *
 * Everything here is static arithmetic over files already on disk — no model
 * call, no inference tokens.
 */

import fs from 'node:fs'
import path from 'node:path'
import { estimateTokens } from './token-accounting.mjs'

const AGENT_REF = /(?:^|[^\w.@])@([a-z][a-z0-9.-]*[a-z0-9])/g
// Segments are matched one at a time so a sentence-ending period is not
// swallowed into the command name: `/speckit.plan.` must yield `speckit.plan`.
const SPECKIT_REF = /\/(speckit\.[a-z0-9]+(?:\.[a-z0-9]+)*)/g
const APPLY_TO = /^applyTo:\s*["']?(.+?)["']?\s*$/m

/** Reads a file, returning '' when absent. */
function read(file) {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

/** Token cost of a file, 0 when it does not exist. */
export function fileTokens(file) {
  return estimateTokens(read(file))
}

/** Expands `{a,b}` alternations into separate patterns. */
export function expandBraces(pattern) {
  const m = /\{([^{}]*)\}/.exec(pattern)
  if (!m) return [pattern]
  return m[1]
    .split(',')
    .flatMap((alt) => expandBraces(pattern.slice(0, m.index) + alt + pattern.slice(m.index + m[0].length)))
}

/** Converts one brace-free glob into an anchored regex. */
function globToRegex(glob) {
  let out = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // `**/` may match zero directories, so the slash is optional.
        out += glob[i + 2] === '/' ? '(?:.*/)?' : '.*'
        i += glob[i + 2] === '/' ? 2 : 1
      } else {
        out += '[^/]*'
      }
    } else if (c === '?') out += '[^/]'
    else out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${out}$`)
}

/**
 * True when a path matches any comma-separated glob in an applyTo value.
 *
 * Braces are expanded BEFORE splitting on commas. An applyTo like
 * `**\/*.{ts,js,vue}` separates its alternatives with the same character that
 * separates patterns, so splitting first shreds it into `**\/*.{ts`, `js` and
 * `vue}` and the whole rule silently stops matching.
 */
export function matchesApplyTo(applyTo, filePath) {
  for (const expanded of expandBraces(String(applyTo))) {
    for (const raw of expanded.split(',')) {
      const trimmed = raw.trim()
      if (trimmed && globToRegex(trimmed).test(filePath)) return true
    }
  }
  return false
}

/**
 * Lists the instruction files the harness injects for a given file in context,
 * with the cost of each.
 *
 * @returns {Array<{ file: string, tokens: number, applyTo: string }>}
 */
export function instructionsFor(root, contextPath, dir = '.github/instructions') {
  const full = path.join(root, dir)
  if (!fs.existsSync(full)) return []

  const matched = []
  for (const name of fs.readdirSync(full).sort()) {
    if (!name.endsWith('.md')) continue
    const text = read(path.join(full, name))
    const applyTo = APPLY_TO.exec(text)?.[1] ?? ''
    if (applyTo && matchesApplyTo(applyTo, contextPath)) {
      matched.push({ file: path.join(dir, name), tokens: estimateTokens(text), applyTo })
    }
  }
  return matched
}

/** Distinct agents a prompt delegates to, excluding spec-kit command names. */
export function agentsIn(text) {
  const found = new Set()
  for (const m of text.matchAll(AGENT_REF)) {
    if (!m[1].startsWith('speckit.')) found.add(m[1])
  }
  return [...found].sort()
}

/**
 * A conditional invocation is not free — it is paid whenever it fires — but
 * charging it to every run overstates the phase and, worse, makes
 * conditionality invisible: turning a step conditional would show zero
 * improvement in this very report.
 *
 * Conditionality is DECLARED with this marker, never inferred from prose. An
 * earlier version guessed from English words like "if", which cannot tell an
 * invocation that is itself conditional from a line that merely mentions a
 * condition for some other reason — and a guard built on a detector that
 * cannot make that distinction guards nothing.
 */
export const CONDITIONAL_MARKER = '[conditional]'

/**
 * Distinct spec-kit commands a prompt invokes, each flagged by whether its
 * invocation line makes it conditional.
 *
 * @returns {Array<{ command: string, conditional: boolean }>}
 */
export function speckitIn(text) {
  const seen = new Map()
  for (const line of text.split('\n')) {
    // Blockquotes are callouts explaining a step, never a step themselves. A
    // note that merely names a command was being scored as an invocation, and
    // because notes carry no marker it silently forced the command back into
    // the floor — inflating the very number this module exists to report.
    if (/^\s*>/.test(line)) continue
    for (const m of line.matchAll(SPECKIT_REF)) {
      const conditional = line.includes(CONDITIONAL_MARKER)
      // A command invoked unconditionally anywhere is paid on every run, even
      // if some other line also mentions it under a condition.
      if (!seen.has(m[1]) || !conditional) seen.set(m[1], conditional)
    }
  }
  return [...seen.entries()]
    .map(([command, conditional]) => ({ command, conditional }))
    .sort((a, b) => a.command.localeCompare(b.command))
}

/**
 * Full fixed cost of one phase.
 *
 * @param {string} root
 * @param {string} promptRel e.g. '.github/prompts/sdd-verify.prompt.md'
 * @returns {{ prompt: number, agents: number, speckit: number, instructions: number,
 *             total: number, detail: object }}
 */
export function phaseContextCost(root, promptRel) {
  const text = read(path.join(root, promptRel))
  const prompt = estimateTokens(text)

  const agentList = agentsIn(text)
  const agents = agentList.reduce((n, a) => n + fileTokens(path.join(root, `.github/agents/${a}.agent.md`)), 0)

  const speckitList = speckitIn(text)
  const costOf = (c) =>
    fileTokens(path.join(root, `.github/agents/${c}.agent.md`)) +
    fileTokens(path.join(root, `.github/prompts/${c}.prompt.md`))

  let speckit = 0
  let conditional = 0
  for (const { command, conditional: isCond } of speckitList) {
    if (isCond) conditional += costOf(command)
    else speckit += costOf(command)
  }

  const instrList = instructionsFor(root, promptRel)
  const instructions = instrList.reduce((n, i) => n + i.tokens, 0)

  // `floor` is what every run of this phase costs. `total` adds what it costs
  // when every conditional branch also fires — the worst case, not the norm.
  const floor = prompt + agents + speckit + instructions
  return {
    prompt,
    agents,
    speckit,
    conditional,
    instructions,
    floor,
    total: floor + conditional,
    detail: {
      agents: agentList,
      speckit: speckitList.filter((s) => !s.conditional).map((s) => s.command),
      conditional: speckitList.filter((s) => s.conditional).map((s) => s.command),
      instructions: instrList.map((i) => i.file),
    },
  }
}

/** Phase key -> prompt file, in lifecycle order. */
export const SDD_PHASES = [
  ['Phase_0_Frame', '.github/prompts/sdd-frame.prompt.md'],
  ['Phase_1_New', '.github/prompts/sdd-new.prompt.md'],
  ['Phase_2_FF', '.github/prompts/sdd-ff.prompt.md'],
  ['Phase_3_Apply', '.github/prompts/sdd-apply.prompt.md'],
  ['Phase_4_Verify', '.github/prompts/sdd-verify.prompt.md'],
  ['Phase_5_Archive', '.github/prompts/sdd-archive.prompt.md'],
]

/** Fixed cost of every phase plus the cycle total. */
export function auditContextBudget(root, phases = SDD_PHASES) {
  const rows = []
  let total = 0
  let floor = 0
  for (const [key, rel] of phases) {
    if (!fs.existsSync(path.join(root, rel))) continue
    const cost = phaseContextCost(root, rel)
    rows.push({ phase: key, ...cost })
    total += cost.total
    floor += cost.floor
  }
  return { rows, total, floor }
}

/**
 * Renders the verdict that matters: how the fixed surface compares to the
 * payload the optimizers actually work on. Reporting one without the other is
 * what let a 76% reduction describe a twentieth of the real bill.
 */
export function formatBudgetSummary(budget, payloadTokens) {
  const { total, floor } = budget
  const combined = floor + payloadTokens
  const share = combined > 0 ? ((payloadTokens / combined) * 100).toFixed(1) : '0.0'
  const heaviest = [...budget.rows].sort((a, b) => b.floor - a.floor)[0]
  const swing = total - floor

  return [
    'COSTO FIJO DE INFRAESTRUCTURA (prosa cargada antes de trabajar):',
    `- PISO, se paga en todo ciclo:                 ${floor.toLocaleString()} tokens`,
    `- TECHO, si además dispara todo lo condicional: ${total.toLocaleString()} tokens`,
    `- Margen condicional:                          ${swing.toLocaleString()} tokens`,
    `- Payload optimizado del ciclo:                ${payloadTokens.toLocaleString()} tokens`,
    `- El payload es el ${share}% del costo de piso del ciclo.`,
    heaviest ? `- Fase más cara: ${heaviest.phase} con ${heaviest.floor.toLocaleString()} tokens de piso.` : '',
    '',
    'Piso y techo se reportan por separado porque un paso condicional no se paga',
    'siempre; contarlo como fijo sobreestima el ciclo y, peor, haría invisible',
    'cualquier mejora que consista precisamente en volver condicional un paso.',
    'Todo esto es aritmética estática sobre archivos en disco: 0 tokens de inferencia.',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Renders the budget as console.table rows. */
export function toBudgetRows({ rows }) {
  return rows.map((r) => ({
    Fase: r.phase,
    Prompt: r.prompt,
    Agentes: r.agents,
    'Spec-Kit': r.speckit,
    'Si aplica': r.conditional,
    Instructions: r.instructions,
    PISO: r.floor,
    TECHO: r.total,
  }))
}
