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

/** Directories no runner is expected to reach. */
// '.conf' holds the installer's snapshot of a previous install and 'scaffold'
// is a byte-for-byte mirror: both contain copies of test files that are not
// meant to run, and counting them as orphans buries the real finding under 43
// false positives — which is exactly what happened the first time this ran in
// an installed workspace rather than in the repository.
const SKIP_DIRS = new Set(['node_modules', '.git', '.nuxt', 'dist', '.output', 'scaffold', '.venv', '.conf', '.sandboxes'])

/** Every test file on disk, whatever the runner. */
export function collectTestFiles(root, dir = '.') {
  const out = []
  const walk = (rel) => {
    const full = path.join(root, rel)
    let entries = []
    try {
      entries = fs.readdirSync(full, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (SKIP_DIRS.has(e.name)) continue
      const childRel = path.join(rel, e.name)
      if (e.isDirectory()) walk(childRel)
      else if (/\.(test|spec)\.(mjs|ts|js)$/.test(e.name)) out.push(path.normalize(childRel))
    }
  }
  walk(dir)
  return out.sort()
}

/**
 * Blanks out `//` and block comments so a commented-out line cannot be read
 * as configuration.
 *
 * Length is preserved so any offset computed against the result still lines
 * up with the original text.
 */
function stripComments(text) {
  // A regex pass is not enough, and getting that wrong is instructive: the
  // first version blanked `/**/` inside the glob `test/**/*.test.ts` itself,
  // turning the pristine config into `test    *.test.ts` and reporting every
  // dashboard test as an orphan. Comment syntax and glob syntax overlap, so
  // the scan has to know when it is inside a string.
  let out = ''
  let quote = null
  for (let i = 0; i < text.length; i++) {
    const c = text[i]

    if (quote) {
      out += c
      if (c === '\\') {
        out += text[++i] ?? ''
      } else if (c === quote) {
        quote = null
      }
      continue
    }

    if (c === '"' || c === "'" || c === '`') {
      quote = c
      out += c
      continue
    }

    if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') {
        out += ' '
        i++
      }
      out += '\n'
      continue
    }

    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      const stop = end === -1 ? text.length : end + 2
      // Newlines are preserved so line numbers still line up.
      for (; i < stop; i++) out += text[i] === '\n' ? '\n' : ' '
      i--
      continue
    }

    out += c
  }
  return out
}

/**
 * The `include` globs a vitest config declares, if there is one.
 *
 * Comments are stripped first, and more than one surviving `include:` is a
 * hard error rather than a silent first-match.
 *
 * An adversarial audit found why both matter. The old version ran a
 * first-match regex over raw text, so the ordinary edit of commenting out the
 * previous value and writing the new one below it made the gate read the
 * COMMENTED glob. Measured on the real dashboard: narrowing `include` to one
 * file drops vitest from 19 collected files to 1, the gate correctly failed
 * with 18 orphans — and adding the commented old line above flipped it back
 * to a green checkmark with the same 18 tests not running.
 *
 * That is verbatim the failure this module exists to prevent, and it also
 * blinded `dropUnreachableTests`, so the Invariant Gate would have certified
 * a contract as enforced by tests the runner never executes.
 */
export function collectVitestIncludes(root) {
  const out = []
  for (const cfg of collectTestFiles.CONFIGS ?? ['vitest.config.ts', 'vitest.config.mjs', 'vite.config.ts']) {
    const full = path.join(root, cfg)
    if (!fs.existsSync(full)) continue

    const source = stripComments(fs.readFileSync(full, 'utf8'))
    const matches = [...source.matchAll(/include\s*:\s*\[([^\]]*)\]/g)]
    if (matches.length === 0) continue
    if (matches.length > 1) {
      // Ambiguous: this reader cannot know which one the runner resolves, and
      // guessing is how the first-match bug happened. Say so instead.
      out.push({ config: cfg, glob: '__AMBIGUOUS__', ambiguous: true })
      continue
    }

    for (const raw of matches[0][1].split(',')) {
      const g = raw.trim().replace(/^['"`]|['"`]$/g, '')
      if (g) out.push({ config: cfg, glob: g })
    }
  }
  return out
}
collectTestFiles.CONFIGS = ['vitest.config.ts', 'vitest.config.mjs', 'vite.config.ts']

/** True when a `**`-capable glob covers a repo-relative path. */
function globCovers(glob, rel) {
  const re = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '(?:.*/)?')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
  return new RegExp(`^${re}$`).test(rel)
}

/**
 * Finds test files that exist and that no runner will ever collect.
 *
 * The glob audit above answers "does this declared glob match a file?". This
 * answers the inverse, and the inverse is the one that bit us: a real cycle
 * wrote `app/utils/token-budget.test.ts`, the Invariant Gate matched its BIC
 * tags and reported the contract enforced — while `vitest.config.ts` pinned
 * `include` to `test/**`, so that file was never collected and never ran.
 *
 * Both halves of the chain were green. The test existed, the tags were there,
 * the suite passed. Nothing in the repository could see that the assertions
 * had never executed.
 *
 * @param {string} root
 * @param {string[]} [searchDirs] limits the walk; defaults to the whole repo
 * @returns {Array<{file: string, reason: string}>}
 */
export function findOrphanTests(root, searchDirs) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  const nodeGlobs = collectTestGlobs(pkg.scripts).map((g) => g.glob)

  const orphans = []
  const dirs = searchDirs ?? ['.']
  for (const dir of dirs) {
    for (const file of collectTestFiles(root, dir)) {
      if (nodeGlobs.some((g) => globCovers(g, file))) continue

      // A file under a workspace package is collected by that package's own
      // runner, so the question moves to its config rather than the root's.
      const pkgDir = findOwningPackage(root, file)
      const includes = collectVitestIncludes(path.join(root, pkgDir))
      const relToPkg = path.relative(pkgDir === '.' ? '.' : pkgDir, file)
      if (includes.some((i) => i.ambiguous)) {
        // Unresolvable is reported, never assumed reachable. Assuming was the
        // whole bug.
        orphans.push({
          file,
          reason: `${pkgDir}/${includes[0].config} declara más de un \`include\` — no se puede saber cuál resuelve el runner`,
        })
      } else if (includes.length === 0) {
        orphans.push({ file, reason: 'ningún glob de node --test lo cubre y no hay config de vitest que lo reclame' })
      } else if (!includes.some((i) => globCovers(i.glob, relToPkg))) {
        orphans.push({ file, reason: `fuera del include de ${pkgDir}/${includes[0].config} (${includes.map((i) => i.glob).join(', ')})` })
      }
    }
  }
  return orphans
}

/** The nearest ancestor directory holding a package.json. */
function findOwningPackage(root, file) {
  let dir = path.dirname(file)
  while (dir !== '.' && dir !== path.sep) {
    if (fs.existsSync(path.join(root, dir, 'package.json'))) return dir
    dir = path.dirname(dir)
  }
  return '.'
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

  // The inverse direction: a test that exists and that nothing will run.
  const orphans = findOrphanTests(root)
  if (orphans.length > 0) {
    console.error(`\n❌ ${orphans.length} archivo(s) de test que ningún runner colecta:`)
    for (const { file, reason } of orphans) console.error(`   - ${file}\n     ${reason}`)
    console.error('\nUn test que no corre satisface igual al Invariant Gate: el tag está en el archivo.')
    process.exit(1)
  }

  console.log('✅ Every declared test glob resolves to at least one file.')
  console.log('✅ Ningún test queda fuera de todos los runners.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
