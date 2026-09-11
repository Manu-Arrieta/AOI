/**
 * scripts/conf/installer-input-safety.test.mjs
 *
 * Three small ways the installer used to overstep, each cheap to fix and each
 * capable of destroying something the operator owns.
 *
 *   - `eval echo "$PROJECT_PATH"` expanded the leading tilde, and every other
 *     shell construct in the string with it. A path typed or pasted as
 *     `/tmp/$(rm -rf ~/algo)x` ran the command before the installer had even
 *     checked the directory existed.
 *   - `rm -f .windsurfrules` ran unconditionally, to clean up a file
 *     `icm init --mode cli` may leave behind. After the fact nothing can tell
 *     ICM's file from one the owner wrote, so a Windsurf user lost their rules
 *     on every install.
 *   - The hook backup overwrote an existing `.aoi-bak`, discarding the
 *     ORIGINAL hook AOI first displaced in favour of whatever replaced it.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SETUP = fs.readFileSync(path.join(REPO, 'setup.sh'), 'utf8')

/** Non-comment lines of the installer. */
const live = SETUP.split('\n').filter((l) => !/^\s*#/.test(l))

describe('the installer does not run what the operator typed', () => {
  it('expands the tilde without eval', () => {
    assert.deepEqual(live.filter((l) => /\beval\s+echo\b/.test(l)), [])
    assert.match(SETUP, /case "\$PROJECT_PATH" in\n\s*"~"\)/)
  })

  it('the replacement expands ~ and executes nothing', () => {
    // Exercised through bash so the claim is about the shell, not the regex.
    const script = `
      PROJECT_PATH="$1"
      case "$PROJECT_PATH" in
        "~") PROJECT_PATH="$HOME" ;;
        "~/"*) PROJECT_PATH="$HOME/\${PROJECT_PATH#\\~/}" ;;
      esac
      printf '%s' "$PROJECT_PATH"
    `
    const run = (arg) => execFileSync('bash', ['-c', script, 'x', arg], { encoding: 'utf8', env: { ...process.env, HOME: '/casa' } })

    assert.equal(run('~'), '/casa')
    assert.equal(run('~/proyecto'), '/casa/proyecto')

    const marker = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-eval-')), 'pwned')
    const hostile = `/tmp/$(touch ${marker})x`
    assert.equal(run(hostile), hostile, 'la ruta se transformó, así que algo la expandió')
    assert.equal(fs.existsSync(marker), false, 'se ejecutó el comando embebido en la ruta')
  })
})

describe('the installer only removes what it created', () => {
  it('decides about .windsurfrules before icm runs, not after', () => {
    assert.match(SETUP, /WINDSURFRULES_PREEXISTING=0/)
    // The check has to precede `icm init --mode cli`; afterwards the file's
    // provenance is unknowable.
    // Sólo líneas ejecutables: el comentario que explica el arreglo también
    // nombra `icm init --mode cli` y adelantaría el índice.
    const guardAt = live.findIndex((l) => l.includes('WINDSURFRULES_PREEXISTING=0'))
    const icmAt = live.findIndex((l) => l.includes('icm init --mode cli'))
    assert.ok(guardAt >= 0 && icmAt >= 0)
    assert.ok(guardAt < icmAt, 'la comprobación quedó después de que icm pudo crear el archivo')
    // El borrado sigue existiendo, y debe: lo que importa es que esté
    // gobernado por la comprobación previa y no colgando suelto.
    const rmAt = live.findIndex((l) => /rm -f "\$PROJECT_PATH\/\.windsurfrules"/.test(l))
    assert.ok(rmAt > icmAt, 'el borrado no está después de icm init')
    assert.match(live[rmAt - 1], /if \[ "\$WINDSURFRULES_PREEXISTING" -eq 0 \]/)
  })

  it('never discards an existing hook backup', () => {
    const idx = SETUP.indexOf('cp "$PROJECT_GITHOOK" "$PROJECT_GITHOOK.aoi-bak"')
    assert.ok(idx > 0)
    const before = SETUP.slice(Math.max(0, idx - 500), idx)
    assert.match(before, /if \[ -f "\$PROJECT_GITHOOK\.aoi-bak" \]; then/)
    assert.match(before, /mv "\$PROJECT_GITHOOK\.aoi-bak"/)
  })
})
