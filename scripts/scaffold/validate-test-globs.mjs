#!/usr/bin/env node
/**
 * scripts/scaffold/validate-test-globs.mjs
 *
 * Fails when a declared test glob matches nothing.
 *
 * `node --test 'some/path/*.test.mjs'` exits 0 when the pattern matches no
 * file. A suite can therefore be emptied — or never installed — and the whole
 * chain still reports green over zero assertions. That is the same failure
 * shape this project keeps finding elsewhere: not an error, but an error
 * reported as success.
 *
 * Two modes, because the same package.json ships to installed workspaces:
 *
 *   strict  — the development repository (recognised by setup.sh at the root).
 *             Every declared glob MUST match at least one file.
 *   lenient — an installed workspace, which legitimately lacks directories
 *             that only exist to test the installer. A missing directory is
 *             reported and tolerated; a directory that exists with no tests
 *             in it is still a failure, because that is real erosion.
 *
 * Zero inference tokens: pure filesystem arithmetic.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TEST_INVOCATION = /node\s+--test\s+([^&|;]+)/g

/** Turns a `*`-style basename pattern into an anchored regex. */
function patternToRegex(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')
  return new RegExp(`^${escaped}$`)
}

/**
 * Expands one glob against the filesystem.
 * @returns {{ dir: string, dirExists: boolean, matches: string[] }}
 */
export function expandGlob(root, glob) {
  const dir = path.dirname(glob)
  const base = path.basename(glob)
  const full = path.join(root, dir)
  if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) {
    return { dir, dirExists: false, matches: [] }
  }
  if (!base.includes('*')) {
    const one = path.join(full, base)
    return { dir, dirExists: true, matches: fs.existsSync(one) ? [path.join(dir, base)] : [] }
  }
  const re = patternToRegex(base)
  const matches = fs
    .readdirSync(full, { withFileTypes: true })
    .filter((e) => e.isFile() && re.test(e.name))
    .map((e) => path.join(dir, e.name))
  return { dir, dirExists: true, matches }
}

/** Collects every glob passed to `node --test` across all package scripts. */
export function collectTestGlobs(scripts) {
  const globs = []
  for (const [name, body] of Object.entries(scripts || {})) {
    for (const match of String(body).matchAll(TEST_INVOCATION)) {
      for (const token of match[1].trim().split(/\s+/)) {
        if (token.startsWith('-')) continue
        globs.push({ script: name, glob: token })
      }
    }
  }
  return globs
}

/**
 * Audits every declared test glob.
 * @returns {{ strict: boolean, checked: number, empty: Array, absent: Array }}
 */
export function auditTestGlobs(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  const strict = fs.existsSync(path.join(root, 'setup.sh'))
  const empty = []
  const absent = []

  for (const entry of collectTestGlobs(pkg.scripts)) {
    const { dirExists, matches } = expandGlob(root, entry.glob)
    if (!dirExists) {
      ;(strict ? empty : absent).push(entry)
    } else if (matches.length === 0) {
      empty.push(entry)
    }
  }
  return { strict, checked: collectTestGlobs(pkg.scripts).length, empty, absent }
}

function main() {
  const root = process.cwd()
  const { strict, checked, empty, absent } = auditTestGlobs(root)

  console.log('=== AOI Test Glob Coverage ===')
  console.log(`Mode:     ${strict ? 'strict (development repository)' : 'lenient (installed workspace)'}`)
  console.log(`Declared: ${checked} test glob(s)`)

  for (const { script, glob } of absent) {
    console.log(`ℹ  not installed here: ${glob}  (${script})`)
  }

  if (empty.length > 0) {
    console.error(`\n❌ ${empty.length} declared test glob(s) match no file:`)
    for (const { script, glob } of empty) {
      console.error(`   - ${glob}   declared by "${script}"`)
    }
    console.error('\nA glob with no match makes `node --test` exit 0 over zero assertions.')
    process.exit(1)
  }

  console.log('✅ Every declared test glob resolves to at least one file.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
