/**
 * scripts/conf/templated-paths.test.mjs
 *
 * `.conf/checksums.json` answers one question for the next reinstall: what did
 * AOI put here? Everything on disk that differs from that answer is read as
 * the owner's edit.
 *
 * Most governed files arrive as a byte copy of the scaffold, so hashing the
 * scaffold answers correctly. A few do not: `.vscode/settings.json` and
 * `.vscode/mcp.json` are JSON objects AOI SHARES with the owner and with
 * spec-kit, materialised around $HOME and an absolute binary path. AOI owns a
 * few keys in each; everyone else owns the rest.
 *
 * Those two are handled in three places, and all three have to name the same
 * set:
 *
 *   - `compare-install.sh` skips them, because file-level classification is
 *     wrong for them in BOTH directions and both were observed on a real
 *     workspace. As a conflict, AOI's updates never land. As an auto-update,
 *     the whole-file copy lands and deletes the other keys — a reinstall
 *     silently removed spec-kit's `chat.promptFilesRecommendations` and
 *     `chat.tools.terminal.autoApprove`.
 *   - `setup.sh` merges AOI's keys into whatever is on disk.
 *   - `snapshot-conf.sh` re-hashes the installed bytes, so checksums.json
 *     records what is actually there rather than a version never installed.
 *
 * Three hard-coded lists that must agree is three chances to go stale in
 * silence, so they are checked against each other and against setup.sh.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SETUP = fs.readFileSync(path.join(REPO, 'setup.sh'), 'utf8')
const SNAPSHOT = fs.readFileSync(path.join(REPO, 'scripts/conf/snapshot-conf.sh'), 'utf8')
const COMPARE = fs.readFileSync(path.join(REPO, 'scripts/conf/compare-install.sh'), 'utf8')

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

/** A newline-separated shell list, by variable name. */
export function shellList(script, varName) {
  const m = script.match(new RegExp(`${varName}="([^"]*)"`))
  if (!m) return []
  return m[1]
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .sort()
}

/** The paths snapshot-conf.sh re-baselines from the installed tree. */
export const declaredTemplatedPaths = (script) => shellList(script, 'TEMPLATED_PATHS')

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

  it('the comparator skips exactly the same set', () => {
    // A file the installer key-merges but the comparator still classifies gets
    // its other keys deleted by the auto-update copy. A file the comparator
    // skips but the installer does not merge simply never gets AOI's keys.
    // Either mismatch is silent, so the two lists are compared directly.
    assert.deepEqual(shellList(COMPARE, 'KEY_MERGED_PATHS'), declaredTemplatedPaths(SNAPSHOT))
  })

  it('the comparator actually consults its list', () => {
    assert.match(COMPARE, /is_key_merged\(\)/)
    assert.match(COMPARE, /if is_key_merged "\$rel_path"; then\n\s*continue/)
  })
})
