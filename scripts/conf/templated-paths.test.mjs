/**
 * scripts/conf/templated-paths.test.mjs
 *
 * `.conf/checksums.json` answers one question for the next reinstall: what did
 * AOI put here? Everything on disk that differs from that answer is read as
 * the owner's edit.
 *
 * Most governed files arrive as a byte copy of the scaffold, so hashing the
 * scaffold answers correctly. A few do not: the installer WRITES them, around
 * $HOME or an absolute binary path the scaffold cannot know. For those,
 * `snapshot-conf.sh` re-hashes the installed bytes — otherwise the installer's
 * own substitution reads as a user edit and the file is a CONFLICT forever,
 * which is what shipped.
 *
 * That list is a hard-coded constant, and a constant that has to track another
 * file is a constant that goes stale in silence: the day someone materialises
 * a third file, nothing fails — a permanent false conflict simply appears in
 * everyone's workspace. So the list is checked against setup.sh mechanically.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SETUP = fs.readFileSync(path.join(REPO, 'setup.sh'), 'utf8')
const SNAPSHOT = fs.readFileSync(path.join(REPO, 'scripts/conf/snapshot-conf.sh'), 'utf8')

/** Shell variables assigned a literal path under $PROJECT_PATH. */
export function projectPathVars(script) {
  const vars = new Map()
  for (const m of script.matchAll(/^([A-Z_][A-Z0-9_]*)="\$PROJECT_PATH\/([^"$]+)"$/gm)) {
    vars.set(m[1], m[2])
  }
  return vars
}

/**
 * Repo-relative paths the installer writes itself, rather than copying.
 *
 * Two spellings reach a file: a heredoc redirect (`cat > "$VAR"`) and the
 * python materialiser (`python3 - "$VAR"`). Both are matched through the
 * variable so a renamed target cannot slip past.
 */
export function installerWrittenPaths(script) {
  const vars = projectPathVars(script)
  const written = new Set()

  for (const m of script.matchAll(/(?:cat\s*>\s*|python3\s+-\s+)"\$([A-Z_][A-Z0-9_]*)"/g)) {
    const rel = vars.get(m[1])
    if (rel) written.add(rel)
  }
  for (const m of script.matchAll(/cat\s*>\s*"\$PROJECT_PATH\/([^"$]+)"/g)) {
    written.add(m[1])
  }
  return [...written].sort()
}

/** The paths snapshot-conf.sh re-baselines from the installed tree. */
export function declaredTemplatedPaths(script) {
  const m = script.match(/TEMPLATED_PATHS="([^"]*)"/)
  if (!m) return []
  return m[1]
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .sort()
}

describe('the templated-path list tracks what the installer actually writes', () => {
  it('declares every installer-written file that the scaffold also ships', () => {
    // Only files present in the scaffold matter: those are the ones
    // checksums.json carries an entry for, and therefore the only ones a
    // wrong baseline can turn into a false conflict.
    const written = installerWrittenPaths(SETUP)
    const inScaffold = written.filter((rel) => fs.existsSync(path.join(REPO, 'scaffold', rel)))
    assert.ok(inScaffold.length > 0, 'el detector no encontró ningún archivo materializado')

    const declared = new Set(declaredTemplatedPaths(SNAPSHOT))
    const missing = inScaffold.filter((rel) => !declared.has(rel))
    assert.deepEqual(
      missing,
      [],
      `setup.sh materializa estos archivos y snapshot-conf.sh no los re-basea:\n  ${missing.join('\n  ')}\n` +
        'Sin re-basear, el primer reinstall los declara conflicto para siempre.'
    )
  })

  it('does not declare a path the scaffold never ships', () => {
    // A stale entry is harmless to the comparator but hides the fact that the
    // file stopped being governed, so it is worth catching too.
    for (const rel of declaredTemplatedPaths(SNAPSHOT)) {
      assert.ok(
        fs.existsSync(path.join(REPO, 'scaffold', rel)),
        `${rel} está declarado como materializado y el scaffold no lo publica`
      )
    }
  })

  it('finds the two known materialised files, so the detector is not vacuous', () => {
    const written = installerWrittenPaths(SETUP)
    assert.ok(written.includes('.vscode/settings.json'), `no detectó settings.json: ${written}`)
    assert.ok(written.includes('.vscode/mcp.json'), `no detectó mcp.json: ${written}`)
  })
})
