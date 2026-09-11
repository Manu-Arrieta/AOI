#!/usr/bin/env node
/**
 * scripts/scaffold/mutation-probe.mjs
 *
 * Asks a suite the only question that distinguishes coverage from
 * verification: if this line were wrong, would anything notice?
 *
 * A test that loads a module proves it parses. A test that asserts on its
 * output proves it answers correctly for the inputs chosen. Neither shows
 * that a given line is CONSTRAINED — that changing it breaks something. This
 * changes it and finds out.
 *
 * A surviving mutant is one of two things, and both are worth knowing: a line
 * nothing checks, or an equivalent mutant — a change with no observable
 * effect through the public surface. The second kind is documented rather
 * than chased; the first is a hole.
 *
 * Usage:
 *   node scripts/scaffold/mutation-probe.mjs <area-dir> <test-glob> [--limit N]
 *
 * Runs entirely on a copy under the system temp directory. The repository is
 * never mutated.
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/**
 * Textual mutations, chosen for a low rate of equivalent mutants: each one
 * inverts a decision the code makes rather than perturbing a value.
 */
export const OPERATORS = [
  { name: 'eq→ne', find: /===/g, replace: '!==' },
  { name: 'ne→eq', find: /!==/g, replace: '===' },
  { name: 'and→or', find: / && /g, replace: ' || ' },
  { name: 'or→and', find: / \|\| /g, replace: ' && ' },
  { name: 'gt→gte', find: / > /g, replace: ' >= ' },
  { name: 'lt→lte', find: / < /g, replace: ' <= ' },
  { name: 'true→false', find: /\btrue\b/g, replace: 'false' },
  { name: 'false→true', find: /\bfalse\b/g, replace: 'true' },
]

/** Lines that are comment noise rather than logic. */
function isSkippable(line) {
  const t = line.trim()
  return t === '' || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')
}

/**
 * Positions inside a string or template literal, or a trailing line comment.
 *
 * Without this the probe mutates the contents of strings, and a separator
 * like `'================='` contains `===`. Those mutants change a banner and
 * nothing else, so they survive every suite and inflate the survivor count
 * with findings that are not about the code's logic at all — the measurement
 * would be reporting on itself.
 */
export function literalMask(line) {
  const mask = new Array(line.length).fill(false)
  let quote = null
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quote) {
      mask[i] = true
      if (c === '\\') {
        if (i + 1 < line.length) mask[i + 1] = true
        i += 1
      } else if (c === quote) {
        quote = null
      }
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
      mask[i] = true
      continue
    }
    if (c === '/' && line[i + 1] === '/') {
      for (let j = i; j < line.length; j++) mask[j] = true
      break
    }
  }
  return mask
}

/**
 * Every single-site mutation of a source file.
 * @returns {Array<{ line: number, operator: string, mutated: string, before: string }>}
 */
export function mutationsFor(source) {
  const lines = source.split('\n')
  const out = []
  lines.forEach((line, i) => {
    if (isSkippable(line)) return
    const masked = literalMask(line)
    for (const op of OPERATORS) {
      op.find.lastIndex = 0
      let m
      while ((m = op.find.exec(line)) !== null) {
        const at = m.index
        // A change inside a literal is a change to data, not to a decision.
        if (masked[at]) continue
        const mutatedLine = line.slice(0, at) + op.replace + line.slice(at + m[0].length)
        if (mutatedLine === line) continue
        const copy = [...lines]
        copy[i] = mutatedLine
        out.push({ line: i + 1, operator: op.name, mutated: copy.join('\n'), before: line.trim() })
      }
    }
  })
  return out
}

/** Sources of an area, excluding its tests. */
export function areaSources(root, area) {
  const dir = path.join(root, area)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs'))
    .map((f) => path.join(area, f))
    .sort()
}

/**
 * Runs a test glob in a workspace; true when it passes.
 *
 * The timeout matters more than it looks. Inverting a loop bound is one of
 * the mutations here, and some of those mutants do not fail — they hang. With
 * a flat three-minute limit a single hanging mutant cost more wall clock than
 * the other two hundred put together, which is how a probe over a
 * one-second suite ends up taking an hour. A hang IS a killed mutant: the
 * suite did not pass.
 */
function suitePasses(cwd, glob, timeout = 180000) {
  try {
    execFileSync('node', ['--test', ...expand(cwd, glob)], { cwd, stdio: 'ignore', timeout })
    return true
  } catch {
    return false
  }
}

/** How long to allow a mutated run, from how long the clean one took. */
export function mutantTimeout(baselineMs) {
  return Math.min(120000, Math.max(15000, baselineMs * 10))
}

function expand(cwd, glob) {
  const dir = path.dirname(glob)
  const base = path.basename(glob).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  const re = new RegExp(`^${base}$`)
  return fs
    .readdirSync(path.join(cwd, dir))
    .filter((f) => re.test(f))
    .map((f) => path.join(dir, f))
    .sort()
}

export async function probe(root, area, testGlob, limit = Infinity, log = () => {}) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-mutate-'))
  // `scaffold` is anchored: the top-level mirror is a duplicate worth
  // skipping, but `scripts/scaffold/` is real source that other areas import,
  // and an unanchored pattern dropped it — the sdd-lifecycle suite then failed
  // in the copy for a reason that had nothing to do with any mutation.
  const EXCLUDED = /(?:^|\/)(?:node_modules|\.git|\.nuxt|\.output|coverage)(?:\/|$)|^scaffold(?:\/|$)/
  fs.cpSync(root, work, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(root, src)
      return rel === '' || !EXCLUDED.test(rel)
    },
  })

  const startedAt = Date.now()
  const baseline = suitePasses(work, testGlob)
  const timeout = mutantTimeout(Date.now() - startedAt)
  if (!baseline) {
    fs.rmSync(work, { recursive: true, force: true })
    throw new Error(`La suite de ${area} ya falla sin mutar; no se puede medir nada sobre eso.`)
  }

  const survivors = []
  let killed = 0
  let total = 0

  for (const rel of areaSources(root, area)) {
    const target = path.join(work, rel)
    const original = fs.readFileSync(target, 'utf8')
    const candidates = mutationsFor(original)
    for (const mutation of candidates) {
      if (total >= limit) break
      total += 1
      fs.writeFileSync(target, mutation.mutated)
      if (suitePasses(work, testGlob, timeout)) {
        survivors.push({ file: rel, ...mutation, mutated: undefined })
      } else {
        killed += 1
      }
      fs.writeFileSync(target, original)
      if (total % 25 === 0) log(`  ${total} mutantes · ${killed} muertos · ${survivors.length} sobreviven`)
    }
    if (total >= limit) break
  }

  fs.rmSync(work, { recursive: true, force: true })
  return { area, total, killed, survivors }
}

async function main() {
  const [area, testGlob] = process.argv.slice(2)
  const limitFlag = process.argv.indexOf('--limit')
  const limit = limitFlag > -1 ? Number(process.argv[limitFlag + 1]) : Infinity
  if (!area || !testGlob) {
    process.stderr.write('Uso: mutation-probe.mjs <area-dir> <test-glob> [--limit N]\n')
    process.exit(2)
  }

  const root = process.cwd()
  process.stdout.write(`=== Mutación sobre ${area} ===\n`)
  const r = await probe(root, area, testGlob, limit, (m) => process.stdout.write(m + '\n'))

  const score = r.total === 0 ? 0 : Math.round((r.killed / r.total) * 100)
  process.stdout.write(`\nMutantes: ${r.total} · muertos: ${r.killed} · sobreviven: ${r.survivors.length} · score ${score}%\n`)
  for (const s of r.survivors) {
    process.stdout.write(`  SOBREVIVE  ${s.file}:${s.line}  [${s.operator}]  ${s.before.slice(0, 90)}\n`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
