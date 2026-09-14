/**
 * scripts/archify-path.test.mjs
 *
 * El resolutor de la ruta de Archify, probado.
 *
 * POR QUÉ IMPORTA EL FORMATO DE SALIDA
 *
 * Este script existe para que las fases no hardcodeen la ruta del renderizador,
 * que puede vivir en cuatro lugares distintos. El llamador lo usa como
 * `node "$(pnpm --silent aoi:archify)" validate …`, así que **stdout tiene que
 * ser la ruta y nada más**: una línea decorativa, un prefijo o un `✓` rompen el
 * comando de forma silenciosa —`node "✓ /ruta"` falla con un error que no
 * menciona Archify—.
 *
 * Y tiene que salir 1 cuando no lo encuentra, para que el `$(…) ||` del shell
 * detecte la ausencia. Un exit 0 con stdout vacío haría que `node ""` fallara
 * igual, pero con un mensaje que manda a buscar el problema al lugar equivocado.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(HERE, 'archify-path.mjs')

/** Corre el script con un HOME controlado y devuelve `{ code, stdout, stderr }`. */
function run(home) {
  const env = { ...process.env, HOME: home }
  try {
    const stdout = execFileSync('node', [SCRIPT], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, stdout, stderr: '' }
  } catch (err) {
    return { code: err.status ?? 1, stdout: String(err.stdout ?? ''), stderr: String(err.stderr ?? '') }
  }
}

/** Un HOME descartable donde el renderizador existe en la ruta indicada. */
function homeWith(rel) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-archify-path-'))
  const full = path.join(root, rel)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, '// renderer')
  return root
}

describe('archify-path resuelve el renderizador', () => {
  it('imprime la ruta del root de .agents cuando existe', () => {
    const home = homeWith('.agents/skills/archify/bin/archify.mjs')
    const r = run(home)
    assert.equal(r.code, 0)
    assert.equal(r.stdout.trim(), path.join(home, '.agents/skills/archify/bin/archify.mjs'))
    fs.rmSync(home, { recursive: true, force: true })
  })

  it('encuentra el de .claude/skills, que es la ubicación que la ruta hardcodeada perdía', () => {
    // El defecto real: las fases escribían `$HOME/.agents/skills/archify/...`.
    // En una máquina donde sólo existe el de `.claude`, ese comando fallaba
    // mientras el doctor reportaba PASSED.
    const home = homeWith('.claude/skills/archify/bin/archify.mjs')
    const r = run(home)
    assert.equal(r.code, 0)
    assert.match(r.stdout.trim(), /\.claude\/skills\/archify\/bin\/archify\.mjs$/)
    fs.rmSync(home, { recursive: true, force: true })
  })

  it('stdout es SÓLO la ruta: el llamador lo usa dentro de `node "$(…)"`', () => {
    const home = homeWith('.agents/skills/archify/bin/archify.mjs')
    const r = run(home)
    const lines = r.stdout.trim().split('\n')
    assert.equal(lines.length, 1, `stdout tiene ${lines.length} líneas; el llamador espera una`)
    assert.ok(path.isAbsolute(lines[0]), 'la ruta no es absoluta')
    // Sin decoración: un prefijo rompería `node "✓ /ruta"`.
    assert.doesNotMatch(lines[0], /[✓▸⚠✗]/, 'stdout trae decoración')
    fs.rmSync(home, { recursive: true, force: true })
  })

  it('no escribe nada en stdout cuando no lo encuentra', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-archify-none-'))
    const r = run(home)
    assert.equal(r.stdout.trim(), '', 'imprimió algo en stdout sin encontrar el renderizador')
    fs.rmSync(home, { recursive: true, force: true })
  })
})

describe('archify-path falla cuando debe', () => {
  it('sale 1 sin renderizador, para que el `||` del shell lo detecte', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-archify-none-'))
    assert.equal(run(home).code, 1)
    fs.rmSync(home, { recursive: true, force: true })
  })

  it('el error dice qué hacer, no sólo que falló', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-archify-none-'))
    const r = run(home)
    assert.match(r.stderr, /install-archify/)
    fs.rmSync(home, { recursive: true, force: true })
  })

  it('un directorio vacío no se confunde con una instalación', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-archify-empty-'))
    fs.mkdirSync(path.join(home, '.agents/skills/archify/bin'), { recursive: true })
    // El directorio existe pero el renderizador no: la instalación está rota.
    assert.equal(run(home).code, 1)
    fs.rmSync(home, { recursive: true, force: true })
  })
})
