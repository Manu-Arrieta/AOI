/**
 * scripts/conf/generate-checksums.test.mjs
 *
 * The script that produces the baseline the entire three-way merge subtracts
 * from, and the first thing in this repository to be measured by mutation in
 * shell. Its score was 56%, and the survivors were in the two places that
 * decide whether the output is usable at all.
 *
 * The stakes changed this cycle. `compare-install.sh` now REFUSES a
 * checksums.json that does not parse or carries no file map — because a
 * corrupt baseline made every file look NEW and turned the reinstall into a
 * wholesale overwrite. That guard is only as good as this generator: if the
 * comma placement is wrong the JSON is malformed and every reinstall aborts,
 * and if the `.gitkeep` skip is inverted the map comes out empty and the
 * reinstall aborts too. Neither had a test.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const GENERATOR = path.join(HERE, 'generate-checksums.sh')

/** A source tree with the given files, returning the generator's parsed output. */
function generate(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-ck-'))
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, body)
  }
  const stdout = execFileSync('bash', [GENERATOR, root, root], { encoding: 'utf8', timeout: 60000 })
  fs.rmSync(root, { recursive: true, force: true })
  return { raw: stdout, json: JSON.parse(stdout) }
}

describe('the checksum map is well-formed JSON at every size', () => {
  // The comma logic is `[ "$i" -eq "$last_idx" ]`. Off by one in either
  // direction produces a trailing comma or a missing one, and the consumer
  // now treats unparseable as fatal.
  for (const [what, files] of [
    ['one file', { 'a.md': 'a\n' }],
    ['two files', { 'a.md': 'a\n', 'b.md': 'b\n' }],
    ['many files', Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`f${i}.md`, `${i}\n`]))],
    ['nested directories', { 'a.md': 'a\n', 'dir/b.md': 'b\n', 'dir/sub/c.md': 'c\n' }],
  ]) {
    it(`parses with ${what}`, () => {
      const { json } = generate(files)
      assert.equal(Object.keys(json.files).length, Object.keys(files).length)
    })
  }

  it('parses when the tree holds nothing to hash', () => {
    // `last_idx` is -1 for an empty array, and the loop must simply not run.
    // An empty map is still valid JSON — and the consumer rejects it on
    // purpose, which only works if it can read it first.
    const { json } = generate({})
    assert.deepEqual(json.files, {})
  })

  it('never emits a trailing comma before the closing brace', () => {
    const { raw } = generate({ 'a.md': 'a\n', 'b.md': 'b\n' })
    assert.doesNotMatch(raw, /,\s*\n\s*\}/, 'coma colgando: el JSON no parsea')
  })
})

describe('what the map contains', () => {
  it('skips .gitkeep, which is scaffolding and not content', () => {
    // Inverted, the map would contain ONLY .gitkeep files — and the new
    // guard in compare-install.sh would then abort every reinstall.
    const { json } = generate({ 'a.md': 'a\n', 'dir/.gitkeep': '', 'dir/b.md': 'b\n' })
    assert.deepEqual(Object.keys(json.files).sort(), ['a.md', 'dir/b.md'])
  })

  it('keys by path relative to the prefix, not by absolute path', () => {
    // The comparator looks these up as `$PROJECT_DIR/$rel_path`; an absolute
    // key would miss every file and classify the whole tree as NEW.
    const { json } = generate({ 'dir/sub/c.md': 'c\n' })
    assert.deepEqual(Object.keys(json.files), ['dir/sub/c.md'])
  })

  it('records a sha256 that actually matches the bytes', () => {
    const { json } = generate({ 'a.md': 'contenido\n' })
    const expected =
      'sha256:' +
      execFileSync('bash', ['-c', 'printf "contenido\\n" | shasum -a 256 | cut -d" " -f1'], {
        encoding: 'utf8',
      }).trim()
    assert.equal(json.files['a.md'], expected)
  })

  it('gives two identical files the same hash and two different files different ones', () => {
    const { json } = generate({ 'a.md': 'igual\n', 'b.md': 'igual\n', 'c.md': 'distinto\n' })
    assert.equal(json.files['a.md'], json.files['b.md'])
    assert.notEqual(json.files['a.md'], json.files['c.md'])
  })

  it('carries the schema marker the consumer looks for', () => {
    const { json } = generate({ 'a.md': 'a\n' })
    assert.equal(json.$schema, 'aoi-conf-checksums-v1')
    assert.equal(typeof json.generated_at, 'string')
  })
})

describe('the generator refuses to guess', () => {
  it('fails without a source directory', () => {
    let code = 0
    try {
      execFileSync('bash', [GENERATOR], { stdio: 'ignore', timeout: 60000 })
    } catch (e) {
      code = e.status ?? 1
    }
    assert.notEqual(code, 0)
  })
})
