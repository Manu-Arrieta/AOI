/**
 * scripts/conf/reinstall-merge.test.mjs
 *
 * Guards the CONSUMER half of the reinstall smart merge.
 *
 * compare-install.sh (the producer) already has its own suite. What shipped
 * broken was the other side: setup.sh serialises the comparison into temp
 * files and reads them back with a bash `while read` loop. A list written
 * without a trailing newline makes `read` return false on its final line, so
 * the loop body never runs for it and the LAST entry of every bucket is
 * silently dropped — no error, no warning, a plausible-looking summary.
 *
 * These tests execute the real code lifted out of setup.sh rather than a
 * re-implementation of it, so the file under test is the file that ships.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SETUP = path.join(REPO_ROOT, 'setup.sh')
const EMITTER_START = 'eval "$(python3 -c "'
const EMITTER_END = '" 2>/dev/null)" || true'

const readSetup = () => fs.readFileSync(SETUP, 'utf8')

/** Lifts the python emitter out of setup.sh so the test runs the shipped code. */
function extractEmitter(src) {
  const from = src.indexOf(EMITTER_START)
  assert.notEqual(from, -1, 'python emitter block not found in setup.sh')
  const to = src.indexOf(EMITTER_END, from)
  assert.notEqual(to, -1, 'python emitter block is unterminated in setup.sh')
  return src.slice(from + EMITTER_START.length, to)
}

/** Lifts every `while read` header that consumes a comparison bucket. */
function extractLoopHeaders(src) {
  return src.split('\n').map((l) => l.trim()).filter((l) => l.includes('read -r rel_file'))
}

/** Runs the emitter against a comparison payload, returning its temp dir. */
function runEmitter(payload) {
  const body = extractEmitter(readSetup()).replace("'''$COMPARE_OUTPUT'''", `'''${JSON.stringify(payload)}'''`)
  const stdout = execFileSync('python3', ['-c', body], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const dir = /COMPARE_TMPDIR=(.+)/.exec(stdout)?.[1]
  assert.ok(dir, `emitter printed no COMPARE_TMPDIR:\n${stdout}`)
  return { dir, stdout }
}

const PAYLOAD = {
  auto_update: ['first.md', 'middle.md', 'last.md'],
  conflict: ['only-one.md'],
  new: ['alpha.md', 'omega.md'],
  skip: ['untouched.md'],
}

describe('reinstall smart merge — bucket serialisation', () => {
  it('terminates every emitted line so no entry is lost to the read loop', () => {
    const { dir } = runEmitter(PAYLOAD)

    for (const [bucket, expected] of [['auto_update', 3], ['conflict', 1], ['new', 2]]) {
      const body = fs.readFileSync(path.join(dir, bucket), 'utf8')
      assert.ok(body.endsWith('\n'), `${bucket} list is not newline-terminated — last entry will be dropped`)
      assert.equal(body.split('\n').filter(Boolean).length, expected)
    }
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('reports counts that match the payload it was given', () => {
    const { dir, stdout } = runEmitter(PAYLOAD)

    assert.match(stdout, /REINSTALL_STATS_UPDATED=3/)
    assert.match(stdout, /REINSTALL_STATS_CONFLICTS=1/)
    assert.match(stdout, /REINSTALL_STATS_NEW=2/)
    assert.match(stdout, /REINSTALL_STATS_SKIPPED=1/)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('emits an empty file for an empty bucket, never a blank line', () => {
    const { dir } = runEmitter({ auto_update: [], conflict: [], new: [], skip: [] })

    // `[ -s ]` in setup.sh must see these as empty, or the loop runs on nothing.
    assert.equal(fs.statSync(path.join(dir, 'auto_update')).size, 0)
    fs.rmSync(dir, { recursive: true, force: true })
  })
})

describe('reinstall smart merge — bucket consumption', () => {
  it('every bucket loop in setup.sh survives an unterminated final line', () => {
    const headers = extractLoopHeaders(readSetup())
    assert.ok(headers.length >= 3, 'expected at least the three bucket-consuming loops')

    for (const header of headers) {
      assert.match(
        header,
        /\|\|\s*\[ -n "\$rel_file" \]/,
        `bucket loop lacks the unterminated-line guard and will drop its last entry: ${header}`
      )
    }
  })

  it('verifies applied files against the scaffold before the baseline advances', () => {
    const src = readSetup()

    // The checksum baseline is regenerated from the scaffold, so a copy that
    // silently failed would be recorded as applied and never retried.
    assert.match(src, /for bucket in auto_update new/, 'no post-merge integrity check over the applied buckets')
    assert.match(src, /cmp -s "\$SCAFFOLD_DIR\/\$rel_file" "\$PROJECT_PATH\/\$rel_file"/, 'applied files are not compared against the scaffold')
    assert.match(src, /MERGE_DRIFT/, 'drift is detected but never counted or reported')

    // The check must run before the temp dir holding the buckets is removed.
    assert.ok(src.indexOf('MERGE_DRIFT=0') < src.indexOf('rm -rf "$COMPARE_TMPDIR"'), 'integrity check runs after the bucket lists are deleted')
  })

  it('never wipes a governed tree wholesale on reinstall', () => {
    const src = readSetup()

    // aoi_apps/ was deleted and re-copied on every reinstall, which destroyed
    // whatever an SDD cycle had implemented in the dashboard. Nothing under
    // the project may be removed outright — the three-way merge decides.
    assert.doesNotMatch(src, /rm -rf "\$PROJECT_PATH\/aoi_apps"/, 'aoi_apps/ is being wiped on reinstall again')
    assert.doesNotMatch(src, /--exclude='aoi_apps\/'/, 'aoi_apps/ is excluded from the merge again')
  })

  it('the shipped loop header copies the final entry of a file with no trailing newline', () => {
    const header = extractLoopHeaders(readSetup())[0]
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-merge-'))
    const src = path.join(root, 'src')
    const dst = path.join(root, 'dst')
    fs.mkdirSync(src)
    fs.mkdirSync(dst)
    for (const f of ['a.md', 'b.md', 'c.md']) fs.writeFileSync(path.join(src, f), f)

    // Deliberately unterminated: this is what the emitter used to produce.
    const list = path.join(root, 'list')
    fs.writeFileSync(list, 'a.md\nb.md\nc.md')

    const script = [
      // No `set -e`: the `[ -z ] && continue` guard returns 1 on a non-empty
      // line, which would abort the loop. setup.sh does not run under -e either.
      'set -u',
      `${header}`,
      '  [ -z "$rel_file" ] && continue',
      '  cp "$SRC/$rel_file" "$DST/$rel_file"',
      `done < "${list}"`,
    ].join('\n')
    execFileSync('bash', ['-c', script], { env: { ...process.env, SRC: src, DST: dst }, stdio: 'ignore' })

    assert.deepEqual(fs.readdirSync(dst).sort(), ['a.md', 'b.md', 'c.md'])
    fs.rmSync(root, { recursive: true, force: true })
  })
})
