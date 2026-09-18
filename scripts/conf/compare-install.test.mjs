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
 * Every directory the owner accumulates work in, as `is_protected_path` in
 * compare-install.sh names them.
 *
 * The fixture used to seed `.tasks/` alone, and so did the assertion. The other
 * three were named in a `case` branch and measured by nobody — delete
 * `.resources/*` from that branch and the whole suite stays green while a
 * reinstall starts eating the owner's constitution and user stories. A
 * protection nobody tests is one commit from not existing.
 *
 * Each file here is recorded in the previous checksums with a hash that MATCHES
 * what the project holds, which is the dangerous shape on purpose: pristine and
 * absent from the current scaffold is exactly what qualifies a file for
 * removal, so only `is_protected_path` stands between these and `rm -f`.
 */
const STATE_DIR_FILES = Object.freeze({
  '.tasks/registry.md': 'the owner task registry\n',
  '.resources/constitution.md': 'the owner resource governance\n',
  '.resources/userstories/us-001.md': 'a user story the owner wrote\n',
  '.sandboxes/blueprint/manifest.json': '{"sandbox":"owner"}\n',
  '.conf/install-manifest.json': '{"profile":"dashboard"}\n',
})

/** The distinct state directories the files above stand for. */
const STATE_DIRS = Object.freeze([...new Set(Object.keys(STATE_DIR_FILES).map((f) => `${f.split('/')[0]}/`))])

/**
 * Builds a scaffold + installed-project pair covering all four classifications,
 * then runs compare-install.sh against it with the SYSTEM bash.
 */
function runComparison(profile = 'dashboard') {
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
  // converged.md  — scaffold changed AND user changed, to the SAME content -> skip
  write(scaffold, 'converged.md', 'both landed here\n')
  write(project, 'converged.md', 'both landed here\n')

  // aoi_apps/ is governed like any other tree. The dashboard file AOI ships is
  // upgradable; the file an SDD cycle implemented exists only in the project
  // and must never be visited, because the loop walks the scaffold.
  write(scaffold, 'aoi_apps/dashboard/server/utils/aoi-owned.ts', 'v2\n')
  write(project, 'aoi_apps/dashboard/server/utils/aoi-owned.ts', 'v1\n')
  write(project, 'aoi_apps/dashboard/server/utils/user-feature.ts', 'implemented by an SDD cycle\n')

  // Orphans: recorded in the previous install, absent from the scaffold now.
  // Only the untouched one may be removed; the edited one is the owner's, and
  // anything under a state directory is off limits whatever its hash says.
  write(project, 'retired.md', 'shipped by an older AOI\n')
  write(project, 'retired-edited.md', 'owner rewrote this\n')
  for (const [rel, body] of Object.entries(STATE_DIR_FILES)) write(project, rel, body)

  const checksums = {
    $schema: 'aoi-conf-checksums-v1',
    generated_at: new Date().toISOString(),
    files: {
      'untouched.md': sha256('same\n'),
      'upgraded.md': sha256('v1\n'),
      'clashing.md': sha256('scaffold-v1\n'),
      'converged.md': sha256('what AOI shipped before both sides moved\n'),
      'aoi_apps/dashboard/server/utils/aoi-owned.ts': sha256('v1\n'),
      'retired.md': sha256('shipped by an older AOI\n'),
      'retired-edited.md': sha256('what AOI originally shipped\n'),
      ...Object.fromEntries(Object.entries(STATE_DIR_FILES).map(([rel, body]) => [rel, sha256(body)])),
    },
  }
  const checksumsPath = path.join(root, 'checksums.json')
  fs.writeFileSync(checksumsPath, JSON.stringify(checksums, null, 2))

  const stdout = execFileSync('bash', [SCRIPT, scaffold, checksumsPath, project, profile], {
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

    assert.deepEqual(parsed.skip, ['converged.md', 'untouched.md'])
    assert.deepEqual(parsed.auto_update, ['aoi_apps/dashboard/server/utils/aoi-owned.ts', 'upgraded.md'])
    assert.deepEqual(parsed.conflict, ['clashing.md'])
    assert.deepEqual(parsed.new, ['arrived.md'])
  })

  it('does not invent a conflict when both sides moved to the same content', () => {
    const parsed = JSON.parse(runComparison())

    // This is what a fix applied by hand upstream and copied downstream leaves
    // behind: the scaffold moved, the project moved, and they agree. Read as a
    // conflict it sent the operator to .conf/conflicts/ to reconcile two
    // byte-identical files — and a false conflict is indistinguishable from a
    // real one, so it costs the real ones their signal.
    assert.ok(parsed.skip.includes('converged.md'), 'un archivo ya convergido debe ser skip')
    assert.ok(!parsed.conflict.includes('converged.md'), 'conflicto inventado sobre contenido idéntico')
    assert.ok(!parsed.auto_update.includes('converged.md'), 'no hay nada que copiar: ya son iguales')
  })

  it('upgrades AOI-owned files inside aoi_apps instead of replacing the whole tree', () => {
    const parsed = JSON.parse(runComparison())

    // Regression guard: aoi_apps/ used to be excluded here and wholesale
    // replaced by setup.sh, which destroyed features implemented by an SDD
    // cycle. It must now be classified like any other governed tree.
    assert.ok(
      parsed.auto_update.includes('aoi_apps/dashboard/server/utils/aoi-owned.ts'),
      'aoi_apps/ is excluded from the comparison again'
    )

    // A file the user owns is absent from the scaffold, so it must be invisible
    // to every bucket — that is precisely why it survives the reinstall.
    const everything = [...parsed.skip, ...parsed.auto_update, ...parsed.conflict, ...parsed.new]
    assert.ok(
      !everything.some((f) => f.endsWith('user-feature.ts')),
      'a project-only file leaked into a bucket and could be overwritten'
    )
  })

  it('Core preserves an existing dashboard by excluding it from every merge decision', () => {
    const parsed = JSON.parse(runComparison('core'))
    const decisions = [
      ...parsed.skip, ...parsed.auto_update, ...parsed.conflict,
      ...parsed.new, ...parsed.orphan, ...parsed.orphan_modified,
    ]
    assert.ok(
      !decisions.some((file) => file.startsWith('aoi_apps/')),
      `Core intentó gobernar una app auxiliar existente: ${decisions.join(', ')}`
    )
    assert.ok(parsed.auto_update.includes('upgraded.md'), 'el filtro de perfil ocultó archivos Core no relacionados')
  })

  it('marks a file AOI no longer ships as an orphan when the owner never touched it', () => {
    const parsed = JSON.parse(runComparison())

    // Without this, an obsolete prompt or agent lingers forever in installed
    // workspaces and stays invocable, reading as current to humans and models.
    assert.deepEqual(parsed.orphan, ['retired.md'])
  })

  it('never removes an obsolete file the owner edited, and never touches state dirs', () => {
    const parsed = JSON.parse(runComparison())

    assert.deepEqual(parsed.orphan_modified, ['retired-edited.md'])

    // A state directory holds the owner's accumulated work. It must not appear
    // in ANY bucket, not even as a reported orphan — there is no scenario where
    // the installer decides something about it.
    const everything = [
      ...parsed.skip, ...parsed.auto_update, ...parsed.conflict,
      ...parsed.new, ...parsed.orphan, ...parsed.orphan_modified,
    ]
    for (const dir of STATE_DIRS) {
      const leaked = everything.filter((f) => f.startsWith(dir))
      assert.deepEqual(leaked, [], `${dir} leaked into the installer decision set: ${leaked.join(', ')}`)
    }
  })

  it('protects every state directory is_protected_path names, not just the tested one', () => {
    // Reads the branch itself, so dropping a directory from it fails here even
    // if someone also deletes the fixture that would have caught it. The list
    // above and the list in the script are one rule in two places; this is
    // what keeps them from drifting apart in silence.
    const branch = fs.readFileSync(SCRIPT, 'utf8').match(/is_protected_path\(\)\s*\{[\s\S]*?\n\}/)
    assert.ok(branch, 'is_protected_path disappeared from compare-install.sh')

    for (const dir of STATE_DIRS) {
      assert.ok(
        branch[0].includes(`${dir}*`),
        `${dir} is no longer protected by is_protected_path — a reinstall can delete the owner's work there`
      )
    }
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
    assert.equal(manifest.installation_profile, 'dashboard', 'el default preserva instalaciones históricas')

    fs.rmSync(root, { recursive: true, force: true })
  })

  it('snapshot Core never records dashboard files it did not materialise', () => {
    const snapshot = path.join(path.dirname(SCRIPT), 'snapshot-conf.sh')
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-snapshot-core-'))
    const scaffold = path.join(root, 'scaffold')
    const project = path.join(root, 'project')
    fs.mkdirSync(path.join(scaffold, 'aoi_apps', 'agentic-ops-dashboard'), { recursive: true })
    fs.mkdirSync(project, { recursive: true })
    fs.writeFileSync(path.join(scaffold, 'core.md'), 'core\n')
    fs.writeFileSync(path.join(scaffold, 'aoi_apps', 'agentic-ops-dashboard', 'package.json'), '{}\n')

    execFileSync('bash', [snapshot, scaffold, project, 'install', '9.9.9', 'core'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    })

    const manifest = JSON.parse(fs.readFileSync(path.join(project, '.conf', 'manifest.json'), 'utf8'))
    const checksums = JSON.parse(fs.readFileSync(path.join(project, '.conf', 'checksums.json'), 'utf8'))
    assert.equal(manifest.installation_profile, 'core')
    assert.deepEqual(Object.keys(checksums.files), ['core.md'])
    assert.equal(fs.existsSync(path.join(project, '.conf', 'snapshots', 'aoi_apps', 'agentic-ops-dashboard', 'package.json')), false)
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
