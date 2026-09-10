/**
 * scripts/multi-harness/zero-input-verdicts.test.mjs
 *
 * Un veredicto afirmativo sobre cero entradas no dice que todo resuelve: dice
 * que no había nada que resolver.
 *
 * Una auditoría adversaria encontró dos compuertas haciendo exactamente eso.
 * `validate-agent-routing` imprimía "Every agent resolves to a model" con el
 * registro vacío, y `reference-integrity` imprimía "Every reference resolves"
 * con cero archivos escaneados. Un `.github/` vaciado por un merge malo, o
 * una compuerta apuntada al directorio equivocado, sacaban el checkmark.
 *
 * Es la misma patología que este repositorio viene cazando en todos lados —
 * verde sobre nada — apuntada contra sus propios guardianes.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** An empty workspace with only the directory the gate expects. */
function emptyWorkspace(dir) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-zero-'))
  fs.mkdirSync(path.join(root, dir), { recursive: true })
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true })
  fs.writeFileSync(path.join(root, 'package.json'), '{}')
  return root
}

/** Runs a gate in a directory and returns its exit code, never through a pipe. */
function exitCode(script, cwd) {
  try {
    execFileSync('node', [path.join(REPO, script)], { cwd, stdio: 'ignore', timeout: 60000 })
    return 0
  } catch (e) {
    return e.status ?? 1
  }
}

const GATES = [
  { script: 'scripts/multi-harness/validate-agent-routing.mjs', dir: '.github/agents' },
  { script: 'scripts/multi-harness/reference-integrity.mjs', dir: '.github' },
]

describe('a gate refuses to pass over an empty input set', () => {
  for (const { script, dir } of GATES) {
    it(`${path.basename(script)} fails when there is nothing to check`, () => {
      const root = emptyWorkspace(dir)
      assert.notEqual(exitCode(script, root), 0, 'afirmó sobre cero entradas')
      fs.rmSync(root, { recursive: true, force: true })
    })
  }

  it('both still pass on the development repository, which has plenty to check', (t) => {
    // El guard no debe convertirse en un bloqueo permanente: sobre entradas
    // reales las compuertas tienen que seguir aprobando.
    //
    // Sólo en el repositorio de desarrollo. En un workspace instalado estas
    // compuertas juzgan también la prosa del Owner, y su veredicto no es un
    // hecho sobre AOI — es el mismo split estricto/laxo que ya aplican
    // validate-srp y token-tool-coverage.
    if (!fs.existsSync(path.join(REPO, 'setup.sh'))) {
      t.skip('workspace instalado: el veredicto no es sobre AOI')
      return
    }
    for (const { script } of GATES) {
      assert.equal(exitCode(script, REPO), 0, `${script} falla sobre el repo real`)
    }
  })
})
