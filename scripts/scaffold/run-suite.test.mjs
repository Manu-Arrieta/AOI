/**
 * scripts/scaffold/run-suite.test.mjs
 *
 * C5 y C3 de la auditoría 2026-09-30: lo que la cadena de `pnpm test` corre y lo
 * que dice haber corrido.
 *
 *   · C5: en una instalación core real `pnpm test:conf` imprimía `tests 0` y
 *     salía 0, porque `scripts/conf/` no se instala. `run-suite.mjs` lo omite en
 *     voz alta, y en el repositorio de desarrollo falla.
 *   · C3: CLAUDE.md afirma que la cadena corre `aoi:invariant-gate` y
 *     `aoi:blueprint-gate`, y la cadena no los corría. Se compara contra la
 *     fuente de esa tabla, no contra una lista escrita a mano acá.
 */

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { planSuite, runSuite } from './run-suite.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../..')
const CLI = path.join(HERE, 'run-suite.mjs')

/** Un árbol con `package.json` y los archivos dados; `dev` agrega `setup.sh`. */
function tree(scripts, files = {}, { dev = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi run-suite-'))
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts }))
  if (dev) fs.writeFileSync(path.join(root, 'setup.sh'), '#!/bin/sh\n')
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), body)
  }
  return { root, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) }
}

// Sin `NODE_TEST_CONTEXT`: heredado del runner que corre ESTE archivo, el
// `node --test` nieto reporta en el protocolo interno y el stdout llega vacío.
const { NODE_TEST_CONTEXT, ...ENV } = process.env
const run = (root, name) => spawnSync(process.execPath, [CLI, name], { cwd: root, env: ENV, encoding: 'utf8', timeout: 60000 })
const SUITE = { 'test:conf': 'node --test scripts/conf/*.test.mjs' }
const PASSING = "import test from 'node:test'\ntest('uno', () => {})\n"

describe('run-suite: una suite ausente no se reporta como verde', () => {
  it('C5: instalado y sin el directorio, dice omitido y no corre nada', () => {
    const { root, cleanup } = tree(SUITE)
    try {
      const r = run(root, 'test:conf')
      assert.equal(r.status, 0, r.stderr)
      assert.match(r.stdout, /test:conf omitido: scripts\/conf no se instala en este workspace/)
      assert.doesNotMatch(r.stdout, /ℹ pass/, 'corrió node --test sobre cero archivos')
    } finally {
      cleanup()
    }
  })

  it('en el repositorio de desarrollo, la misma ausencia falla', () => {
    const { root, cleanup } = tree(SUITE, {}, { dev: true })
    try {
      const r = run(root, 'test:conf')
      assert.equal(r.status, 1)
      assert.match(r.stderr, /scripts\/conf no existe en el repositorio de desarrollo/)
    } finally {
      cleanup()
    }
  })

  it('un directorio sin tests falla en los dos lados', () => {
    for (const dev of [false, true]) {
      const { root, cleanup } = tree(SUITE, { 'scripts/conf/nada.mjs': 'export {}\n' }, { dev })
      try {
        assert.equal(planSuite(root, 'test:conf').mode, 'error')
      } finally {
        cleanup()
      }
    }
  })

  it('una instalación parcial falla: medio verde no es verde', () => {
    const { root, cleanup } = tree(
      { s: 'node --test scripts/a/*.test.mjs scripts/b/*.test.mjs' },
      { 'scripts/a/x.test.mjs': PASSING }
    )
    try {
      assert.match(planSuite(root, 's').reason, /instalación parcial: falta scripts\/b/)
    } finally {
      cleanup()
    }
  })

  it('con los tests presentes los corre, y su fallo es el fallo del paso', () => {
    const { root, cleanup } = tree(SUITE, { 'scripts/conf/a.test.mjs': PASSING }, { dev: true })
    try {
      const ok = run(root, 'test:conf')
      assert.equal(ok.status, 0, ok.stderr)
      assert.match(ok.stdout, /ℹ pass 1/)
      fs.writeFileSync(path.join(root, 'scripts/conf/b.test.mjs'), "import test from 'node:test'\ntest('rojo', () => { throw new Error('x') })\n")
      assert.equal(run(root, 'test:conf').status, 1)
    } finally {
      cleanup()
    }
  })

  it('rechaza lo que no es una suite node --test pura, y un uso sin script', () => {
    const { root, cleanup } = tree({ mixto: 'node --test a.test.mjs && echo listo' })
    try {
      assert.equal(runSuite(root, 'mixto', () => assert.fail('no debía correr')), 1)
      assert.equal(runSuite(root, 'inexistente', () => assert.fail('no debía correr')), 1)
      assert.equal(spawnSync(process.execPath, [CLI], { cwd: root }).status, 2)
    } finally {
      cleanup()
    }
  })
})

describe('la cadena de pnpm test corre lo que CLAUDE.md dice que corre', () => {
  const chain = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).scripts.test
  const steps = chain.split('&&').map((s) => s.trim())

  it('C3: cada compuerta de la tabla "Which gate refuses what" es un paso de la cadena', () => {
    // La tabla se compila desde `claude-project-guide.mjs`: se lee la fuente.
    const guide = fs.readFileSync(path.join(REPO, 'scripts/multi-harness/claude-project-guide.mjs'), 'utf8')
    const table = guide.slice(guide.indexOf('## Which gate refuses what'))
    const gates = [...table.matchAll(/^\| \\`((?:aoi|test):[a-z-]+)\\` \|/gm)].map((m) => m[1])
    assert.ok(gates.length >= 10, `la tabla dio ${gates.length} compuertas: el extractor ya no la lee`)
    for (const gate of gates) {
      assert.ok(
        steps.some((s) => s === `pnpm ${gate}` || s.startsWith(`pnpm ${gate} `)),
        `CLAUDE.md dice que pnpm test corre ${gate} y la cadena no lo corre`
      )
    }
  })

  it('C3: el Invariant Gate y el Blueprint Gate corren en modo --chain', () => {
    assert.ok(steps.includes('pnpm aoi:invariant-gate --chain'))
    // Sin --chain, un worktree o un CI sin icm saldría 2 por "no pude leer".
    assert.ok(steps.includes('pnpm aoi:blueprint-gate --chain'))
  })

  it('C5: la suite de conf pasa por run-suite, no por node --test directo', () => {
    assert.ok(steps.includes('node scripts/scaffold/run-suite.mjs test:conf'))
    assert.ok(!steps.includes('pnpm test:conf'))
  })
})
