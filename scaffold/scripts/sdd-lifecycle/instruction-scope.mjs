/**
 * scripts/sdd-lifecycle/instruction-scope.mjs
 *
 * Resolves WHICH instruction files the harness injects for a given file in
 * context, by matching each file's `applyTo` glob against the path.
 *
 * Split out of context-budget.mjs when that module crossed the 300 LOC limit
 * of Invariant 5. The boundary is a real one: deciding what the harness
 * injects is a separate question from what a phase costs, and the glob
 * machinery here is the part with its own edge cases — brace expansion,
 * `**` matching zero directories, and the ordering bug where splitting on
 * commas before expanding braces shredded every multi-extension rule.
 */

import fs from 'node:fs'
import path from 'node:path'
import { estimateTokens } from './token-accounting.mjs'

const APPLY_TO = /^applyTo:\s*["']?(.+?)["']?\s*$/m

/** Reads a file, returning '' when absent. */
export function read(file) {
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

// ── Skills ──────────────────────────────────────────────────────────────────
// Skills are loaded by the harness on their own declared trigger, and were
// missing from the budget entirely. That omission was larger than every saving
// this branch achieved put together, and no audit of a diff would ever have
// surfaced it: the cost was never wrong, it was never counted.
//
// Applicability is written down HERE rather than inferred from each skill's
// description at runtime. Reading intent out of English is the mistake this
// module already made once with `applyTo`; a reviewed map is deterministic and
// can be argued with. Each entry quotes the trigger it was derived from.
export const SKILL_SCOPE = {
  // "Use when running any /sdd-* command"
  'sdd-lifecycle': () => true,
  // "Use when starting new work, deciding between /sdd-frame and /sdd-new" —
  // la decisión de entrada ya está tomada en las cuatro fases posteriores.
  'sdd-entry': (phase) => /_Frame$|_New$/.test(phase),
  // "Use when the task involves remembering context, decisions, errors, or
  //  project knowledge across sessions" — every phase opens by recalling ICM.
  icm: () => true,
  // "Use when running terminal commands" — every phase shells out.
  rtk: () => true,
  // "Use when running any /speckit.* command or when generating spec/plan/tasks"
  'spec-kit-integration': (phase) => /_FF$|_Apply$/.test(phase),
  // "Use when running /export-memory-bundle, /import..." — outside the cycle.
  'memory-governance': () => false,
}

/** Lists the skills the harness loads for a phase, with the cost of each. */
export function skillsFor(root, phase, dir = '.github/skills') {
  const full = path.join(root, dir)
  if (!fs.existsSync(full)) return []

  const loaded = []
  for (const name of fs.readdirSync(full).sort()) {
    const file = path.join(dir, name, 'SKILL.md')
    if (!fs.existsSync(path.join(root, file))) continue
    const applies = SKILL_SCOPE[name]
    // An unmapped skill is charged rather than ignored: a silent omission is
    // exactly how 21.792 tokens went unmeasured in the first place.
    if (applies && !applies(phase)) continue
    loaded.push({ file, name, tokens: fileTokens(path.join(root, file)), mapped: Boolean(applies) })
  }
  return loaded
}
