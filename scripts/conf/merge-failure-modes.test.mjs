/**
 * scripts/conf/merge-failure-modes.test.mjs
 *
 * What the reinstall does when its own machinery fails.
 *
 * The three-way merge is subtraction against `.conf/checksums.json`: what is
 * on disk, minus what AOI recorded installing, is the owner's edit. Every
 * failure mode below breaks that subtraction, and each one used to end in a
 * green line rather than a message.
 *
 *   - A comparator that exits non-zero was folded into `|| echo '{}'`, and
 *     `{}` is valid JSON: every list parsed empty, nothing was copied, and the
 *     run printed "Reinstall merge complete". A reinstall that updated nothing
 *     reported success.
 *   - A checksums file that exists but does not parse is worse than a missing
 *     one: every path answers the empty string, every scaffold file is
 *     classified NEW, and NEW files are copied unconditionally — so a corrupt
 *     baseline overwrites every governed file the owner ever edited.
 *   - A Phase 7 snapshot that fails leaves no baseline at all, so the NEXT run
 *     sees no manifest, concludes "first install", and lets
 *     `specify init --force` flatten .github/ and .specify/.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const COMPARE = path.join(REPO, 'scripts/conf/compare-install.sh')
const SETUP = fs.readFileSync(path.join(REPO, 'setup.sh'), 'utf8')

/** Runs the comparator against a given checksums body. @returns exit code */
function compareWith(checksumsBody) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-merge-'))
  fs.mkdirSync(path.join(root, 'scaffold'), { recursive: true })
  fs.mkdirSync(path.join(root, 'proj'), { recursive: true })
  fs.writeFileSync(path.join(root, 'scaffold/a.md'), 'contenido\n')
  fs.writeFileSync(path.join(root, 'ck.json'), checksumsBody)
  try {
    execFileSync('bash', [COMPARE, path.join(root, 'scaffold'), path.join(root, 'ck.json'), path.join(root, 'proj')], {
      stdio: 'ignore',
      timeout: 60000,
    })
    return 0
  } catch (e) {
    return e.status ?? 1
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

describe('an unusable baseline stops the merge instead of overwriting everything', () => {
  const UNUSABLE = [
    ['no es JSON', 'esto no es json\n'],
    ['sin mapa de archivos', '{"otra":1}\n'],
    ['mapa vacío', '{"files":{}}\n'],
  ]
  for (const [what, body] of UNUSABLE) {
    it(`rechaza un checksums.json ${what}`, () => {
      assert.notEqual(compareWith(body), 0, 'siguió adelante con una línea base inservible')
    })
  }

  it('acepta una línea base válida, así que el guard no bloquea el caso normal', () => {
    assert.equal(compareWith('{"files":{"a.md":"sha256:deadbeef"}}\n'), 0)
  })
})

describe('setup.sh no confunde un fallo con "no había nada que hacer"', () => {
  it('captura el exit status del comparador por separado', () => {
    // `|| echo '{}'` producía JSON válido a partir de un fallo, y la guarda de
    // validez que ya existía lo aceptaba sin decir nada.
    const live = SETUP.split('\n').filter((l) => !/^\s*#/.test(l))
    assert.deepEqual(
      live.filter((l) => /\|\| echo '\{\}'/.test(l)),
      [],
      'un fallo del comparador vuelve a convertirse en JSON válido'
    )
    assert.match(SETUP, /COMPARE_STATUS=\$\?/)
    assert.match(SETUP, /if \[ "\$COMPARE_STATUS" -ne 0 \]; then/)
  })

  it('aborta si no puede escribir su propia línea base en la Fase 7', () => {
    // Continuar deja un workspace cuyo próximo reinstall corre
    // `specify init --force` sobre .github/ y .specify/.
    const phase7 = SETUP.slice(SETUP.indexOf('Phase 7: Persist Configuration Snapshot'))
    assert.match(phase7, /if bash "\$CONF_SNAPSHOT_SCRIPT"/)
    assert.doesNotMatch(phase7, /warn "Configuration snapshot failed/)
    assert.match(phase7, /exit 1/)
  })
})
