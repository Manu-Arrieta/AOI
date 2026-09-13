/**
 * scripts/sdd-lifecycle/behavioral-runner.test.mjs
 *
 * Prueba la ORQUESTACIÓN: que emita una sonda por archivo, con su índice y su
 * contexto de fase. El juez tiene su propia suite en `behavioral-judge.test.mjs`.
 *
 * Split de este archivo cuando cruzó las 300 LOC del Invariante 5 al sumar los
 * contraejemplos adversariales: juzgar una respuesta y orquestar una corrida son
 * dos trabajos, y el corte sigue el del código.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'
import { PROBES } from './behavioral-scenarios.mjs'
import { emitProbes } from './behavioral-runner.mjs'

const SANDBOXES = []

after(() => {
  for (const dir of SANDBOXES) fs.rmSync(dir, { recursive: true, force: true })
})

describe('emitir las sondas', () => {
  it('escribe una por sonda y un índice que dice qué existía', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-probes-'))
    SANDBOXES.push(dir)
    const written = emitProbes(process.cwd(), dir)

    assert.equal(written.length, PROBES.length)
    for (const w of written) assert.ok(fs.existsSync(w.file), `no escribió ${w.file}`)
    const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'))
    assert.equal(index.length, PROBES.length)
    assert.deepEqual(
      index.map((x) => x.id).sort(),
      PROBES.map((x) => x.id).sort()
    )
  })

  it('el prompt emitido lleva el contexto de la fase, no sólo la pregunta', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-probes-'))
    SANDBOXES.push(dir)
    emitProbes(process.cwd(), dir)
    const text = fs.readFileSync(path.join(dir, `${PROBES[0].id}.txt`), 'utf8')

    assert.match(text, /INICIO DEL CONTEXTO DE LA FASE/)
    assert.match(text, /PREGUNTA:/)
    assert.ok(text.length > 1000, 'el prompt salió sin contexto: mediría una conducta que no es la real')
  })
})
