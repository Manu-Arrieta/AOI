/**
 * scripts/code-lens/lens-cli-flags.test.mjs
 *
 * Los lentes existen para ahorrar contexto, y su modo barato se pide con un
 * flag. Medido (auditoría 2026-09-30, D6): `aoi:graph --hub` y
 * `aoi:determinism --summry` ignoraban el typo y devolvían la salida COMPLETA
 * —38.247 y 32.243 bytes sobre este árbol— con exit 0. El agente que se
 * equivocaba en una letra pagaba el contexto que el flag debía evitar, sin
 * enterarse. Acá cada typo tiene que salir con 2 y sin una línea en stdout.
 *
 * Se corren en un directorio vacío: lo que se mide es el parseo, no el árbol.
 */

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, describe, it } from 'node:test'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CWD = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi lens flags-'))
after(() => fs.rmSync(CWD, { recursive: true, force: true }))

const run = (lens, args) => spawnSync(process.execPath, [path.join(HERE, lens), ...args], { cwd: CWD, encoding: 'utf8' })

function assertRefused(r, pattern) {
  assert.equal(r.status, 2, `exit ${r.status}; stdout=${r.stdout.slice(0, 200)}`)
  assert.equal(r.stdout, '', 'imprimió salida aunque el flag era inválido')
  assert.match(r.stderr, pattern)
}

describe('los lentes rechazan el flag mal escrito en vez de devolver la salida completa', () => {
  it('interaction-graph: --hub y la combinación --hubs --cycles', () => {
    assertRefused(run('interaction-graph.mjs', ['--hub']), /Flags válidos: --hubs --cycles/)
    assertRefused(run('interaction-graph.mjs', ['--hubs', '--cycles']), /no se combinan/)
    assert.equal(run('interaction-graph.mjs', ['--cycles']).status, 0)
  })

  it('determinism-classifier: --summry y un argumento suelto', () => {
    assertRefused(run('determinism-classifier.mjs', ['--summry']), /Flags válidos: --summary/)
    assertRefused(run('determinism-classifier.mjs', ['summary']), /summary/)
    assert.equal(run('determinism-classifier.mjs', ['--summary']).status, 0)
  })

  it('ast-skeletonizer: --stat, dos archivos, y el flag antes del archivo', () => {
    const file = path.join(CWD, 'm.mjs')
    fs.writeFileSync(file, 'export function f(a) {\n  return a + 1\n}\n')
    assertRefused(run('ast-skeletonizer.mjs', [file, '--stat']), /Flags válidos: --stats --help\|-h/)
    assertRefused(run('ast-skeletonizer.mjs', [file, file]), /un archivo por invocación/)
    // Antes el archivo era `args[0]`: `--stats m.mjs` buscaba un archivo `--stats`.
    const ok = run('ast-skeletonizer.mjs', ['--stats', file])
    assert.equal(ok.status, 0, ok.stderr)
    assert.match(ok.stdout, /AST-Lens Compression Stats/)
  })
})
