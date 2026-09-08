import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'compare-install.sh')

const sha256 = (text) => `sha256:${crypto.createHash('sha256').update(text).digest('hex')}`

/**
 * Builds a scaffold + installed-project pair covering all four classifications,
 * then runs compare-install.sh against it with the SYSTEM bash.
 */
function runComparison() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-compare-'))
  const scaffold = path.join(root, 'scaffold')
  const project = path.join(root, 'project')
  fs.mkdirSync(scaffold, { recursive: true })
  fs.mkdirSync(project, { recursive: true })

  const write = (base, rel, body) => {
    const full = path.join(base, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, body)
  }

  // untouched.md  — scaffold unchanged, user unchanged            -> skip
  // upgraded.md   — scaffold changed, user unchanged              -> auto_update
  // clashing.md   — scaffold changed AND user changed             -> conflict
  // arrived.md    — present in scaffold, absent from checksums    -> new
  write(scaffold, 'untouched.md', 'same\n')
  write(project, 'untouched.md', 'same\n')
  write(scaffold, 'upgraded.md', 'v2\n')
  write(project, 'upgraded.md', 'v1\n')
  write(scaffold, 'clashing.md', 'scaffold-v2\n')
  write(project, 'clashing.md', 'user-edit\n')
  write(scaffold, 'arrived.md', 'brand new\n')

  const checksums = {
    $schema: 'aoi-conf-checksums-v1',
    generated_at: new Date().toISOString(),
    files: {
      'untouched.md': sha256('same\n'),
      'upgraded.md': sha256('v1\n'),
      'clashing.md': sha256('scaffold-v1\n'),
    },
  }
  const checksumsPath = path.join(root, 'checksums.json')
  fs.writeFileSync(checksumsPath, JSON.stringify(checksums, null, 2))

  const stdout = execFileSync('bash', [SCRIPT, scaffold, checksumsPath, project], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  fs.rmSync(root, { recursive: true, force: true })
  return stdout
}

describe('compare-install.sh', () => {
  it('emits parseable JSON under the system bash (macOS ships bash 3.2)', () => {
    const stdout = runComparison()

    // Regression guard: `local -n` namerefs need bash 4.3+. When this script
    // aborted mid-JSON on bash 3.2, setup.sh silently fell back to
    // `rsync --ignore-existing`, so no already-installed file was ever updated.
    let parsed
    assert.doesNotThrow(() => {
      parsed = JSON.parse(stdout)
    }, `compare-install.sh emitted non-JSON output:\n${stdout}`)

    for (const key of ['skip', 'auto_update', 'conflict', 'new']) {
      assert.ok(Array.isArray(parsed[key]), `missing array key: ${key}`)
    }
  })

  it('classifies every file into the correct bucket', () => {
    const parsed = JSON.parse(runComparison())

    assert.deepEqual(parsed.skip, ['untouched.md'])
    assert.deepEqual(parsed.auto_update, ['upgraded.md'])
    assert.deepEqual(parsed.conflict, ['clashing.md'])
    assert.deepEqual(parsed.new, ['arrived.md'])
  })

  it('snapshot-conf.sh writes a manifest that is valid JSON even with banner-style tool output', () => {
    const snapshot = path.join(path.dirname(SCRIPT), 'snapshot-conf.sh')
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-snapshot-'))
    const scaffold = path.join(root, 'scaffold')
    const project = path.join(root, 'project')
    fs.mkdirSync(scaffold, { recursive: true })
    fs.mkdirSync(project, { recursive: true })
    fs.writeFileSync(path.join(scaffold, 'a.md'), 'x\n')

    // A fake `specify` that prints multi-line ASCII art with ANSI escapes —
    // exactly what corrupted .conf/manifest.json into unparseable JSON.
    const bin = path.join(root, 'bin')
    fs.mkdirSync(bin, { recursive: true })
    const fake = path.join(bin, 'specify')
    fs.writeFileSync(fake, '#!/bin/sh\nprintf "\\033[1m ___ \\n| "quoted" \\\\ back |\\n CLI Version 9.9.9\\n"\n')
    fs.chmodSync(fake, 0o755)

    execFileSync('bash', [snapshot, scaffold, project, 'install', '9.9.9'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    })

    const raw = fs.readFileSync(path.join(project, '.conf', 'manifest.json'), 'utf8')
    let manifest
    assert.doesNotThrow(() => {
      manifest = JSON.parse(raw)
    }, `manifest.json is not valid JSON:\n${raw}`)
    assert.equal(typeof manifest.tools, 'object')
    assert.match(String(manifest.tools.specify), /9\.9\.9/)

    fs.rmSync(root, { recursive: true, force: true })
  })

  it('uses no bash 4+ only syntax', () => {
    // Comments are stripped so the explanatory note about namerefs does not
    // trip the very check it documents.
    const code = fs
      .readFileSync(SCRIPT, 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n')

    for (const forbidden of ['local -n', 'declare -n', 'mapfile', 'readarray', '${!']) {
      assert.ok(
        !code.includes(forbidden),
        `compare-install.sh uses bash 4+ syntax "${forbidden}" — breaks on macOS bash 3.2`
      )
    }
  })
})
