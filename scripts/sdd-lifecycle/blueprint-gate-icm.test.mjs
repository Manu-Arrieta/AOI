/**
 * scripts/sdd-lifecycle/blueprint-gate-icm.test.mjs
 *
 * El Blueprint Gate entró a la cadena de `pnpm test` y el verificador midió dos
 * falsos verdes que ahí no se veían:
 *
 *   · `readSbcFacts` convertía cualquier error de `icm` en "cero hechos", así que
 *     sin `icm`, con un `icm` que fallaba o con una entidad que ICM no conoce el
 *     gate decía SKIPPED y salía 0 — lo mismo que "no hay SBC".
 *   · la entidad salía de `basename(cwd)`: en un worktree o una copia se auditaba
 *     una entidad que no existe, y también daba SKIPPED.
 *
 * Los `icm` y `git` son stubs de sh en un PATH propio: el test nunca toca el store.
 */

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const GATE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'blueprint-gate.mjs')
const GIT = '#!/bin/sh\necho https://example.invalid/org/REAL-WS.git\n'
const KNOWN_NO_SBC =
  'echo "$*" >> "${0%/*}/calls"\n' + // sin dirname: el PATH sólo tiene los stubs
  'case "$*" in *sbc.*) printf "no facts for %s\\n" "$3" ;; *) printf "key    value\\n-----\\nharness.selected    claude\\n" ;; esac'

/** Un cwd cuyo nombre NO es la entidad, y un PATH con sólo los stubs dados. */
function sandbox({ icm }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi blueprint-icm-'))
  const cwd = path.join(root, 'wt copy')
  const bin = path.join(root, 'bin')
  fs.mkdirSync(cwd)
  fs.mkdirSync(bin)
  fs.writeFileSync(path.join(bin, 'git'), GIT, { mode: 0o755 })
  if (icm) fs.writeFileSync(path.join(bin, 'icm'), `#!/bin/sh\n${icm}\n`, { mode: 0o755 })
  const run = (args) => {
    const r = spawnSync(process.execPath, [GATE, ...args], { cwd, env: { ...process.env, PATH: bin }, encoding: 'utf8' })
    return { code: r.status, out: `${r.stdout}${r.stderr}`, stdout: r.stdout }
  }
  const calls = () => (fs.existsSync(path.join(bin, 'calls')) ? fs.readFileSync(path.join(bin, 'calls'), 'utf8') : '')
  return { run, calls, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) }
}

describe('Blueprint Gate: "no pude leer" no es "no hay SBC"', { skip: process.platform === 'win32' && 'stubs de sh' }, () => {
  it('la entidad sale del remoto origin, como en el Invariant Gate, no del directorio', () => {
    const box = sandbox({ icm: KNOWN_NO_SBC })
    try {
      const r = box.run(['--chain'])
      assert.equal(r.code, 0, r.out)
      assert.match(r.out, /Blueprint Gate: entidad auto-resuelta "REAL-WS" desde git remote origin/)
      assert.match(r.stdout, /SKIPPED\nNo `sbc\.\*` facts found for "REAL-WS"/)
      assert.match(box.calls(), /facts list REAL-WS -p sbc\./)
      assert.doesNotMatch(box.calls(), /wt copy/)
    } finally {
      box.cleanup()
    }
  })

  const cases = [
    ['sin icm en el PATH', null, { chain: 0, plain: 2 }, /not on PATH/],
    ['una entidad que ICM no conoce', 'printf "no facts for %s\\n" "$3"', { chain: 0, plain: 2 }, /no conoce la entidad "REAL-WS"/],
    ['un icm que falla', 'exit 3', { chain: 2, plain: 2 }, /icm exited with an error/],
    ['una tabla que no se puede leer', 'echo basura', { chain: 2, plain: 2 }, /no se pudo leer/],
  ]
  for (const [name, icm, codes, reason] of cases) {
    it(`${name}: NOT AUDITED, nunca SKIPPED (--chain ${codes.chain}, sin él ${codes.plain})`, () => {
      const box = sandbox({ icm })
      try {
        for (const [args, code] of [[['--chain'], codes.chain], [[], codes.plain]]) {
          const r = box.run(args)
          assert.equal(r.code, code, `${args.join(' ')}\n${r.out}`)
          assert.match(r.stdout, /## Blueprint Gate: ⏭️ NOT AUDITED/)
          assert.match(r.stdout, reason)
          assert.doesNotMatch(r.stdout, /SKIPPED|PASSED/)
        }
      } finally {
        box.cleanup()
      }
    })
  }
})
