/**
 * scripts/sdd-lifecycle/context-budget-adapters.test.mjs
 *
 * Split de `context-budget.test.mjs` cuando ese archivo cruzó las 300 LOC del
 * Invariante 5 al sumar los adaptadores de harness. El corte es un límite real:
 * la aritmética del presupuesto por fase es una pregunta, y "qué superficies el
 * piso NO cuenta" es otra — la segunda es sobre lo que el instrumento omite, no
 * sobre lo que mide.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import {
  HARNESS_ADAPTERS,
  auditContextBudget,
  formatHarnessAdapters,
  harnessAdapterCost,
} from './context-budget.mjs'

/** Construye un workspace descartable con la forma de una instalación de AOI. */
function workspace(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-adapters-'))
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, body)
  }
  return root
}

describe('adaptadores de harness: lo que el piso no cuenta', () => {
  it('mide un archivo suelto y un directorio con la misma vara', () => {
    // La lista mezcla las dos formas a propósito: `CLAUDE.md` es un archivo y
    // `.agents/rules` es un directorio. Un medidor que sólo sepa de una de las
    // dos subreporta la otra en silencio, que es como este costo se perdió la
    // primera vez.
    const root = workspace({
      'CLAUDE.md': 'x'.repeat(400),
      '.agents/rules/aoi-rules.md': 'y'.repeat(200),
      '.agents/rules/otra.md': 'z'.repeat(200),
    })
    const r = harnessAdapterCost(root)
    const file = r.rows.find((x) => x.surface === 'CLAUDE.md')
    const dir = r.rows.find((x) => x.surface === '.agents/rules')

    assert.equal(file.files, 1)
    assert.equal(file.tokens, 100)
    assert.equal(dir.files, 2)
    assert.equal(dir.tokens, 100)
    assert.equal(r.total, 200)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('una superficie ausente suma cero y no rompe', () => {
    const root = workspace({})
    const r = harnessAdapterCost(root)
    assert.equal(r.total, 0)
    assert.equal(r.rows.length, HARNESS_ADAPTERS.length)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('el piso NO se mueve: los adaptadores se reportan aparte', () => {
    // Éste es el contrato que hace comparable la medición en el tiempo. Si
    // alguien "arregla" esto sumando los adaptadores al piso, toda línea base
    // histórica deja de ser comparable contra la nueva — y el cambio se vería
    // como una regresión de tokens que no ocurrió.
    const root = workspace({
      '.github/prompts/sdd-frame.prompt.md': 'x'.repeat(400),
      'CLAUDE.md': 'y'.repeat(4000),
    })
    const r = auditContextBudget(root)

    assert.equal(r.adapters.total, 1000, 'no midió los adaptadores')
    assert.equal(r.floorWithAdapters, r.floor + 1000)
    assert.notEqual(r.floor, r.floorWithAdapters, 'sumarlos los volvería el mismo número')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('el reporte dice que no se suma al piso', () => {
    const text = formatHarnessAdapters({ rows: [], total: 100 }, 1000)
    assert.match(text, /NO esta incluida en el piso/)
    assert.match(text, /NO se suma al piso/)
    assert.match(text, /10\.00% del piso/)
  })

  it('sobre el repositorio real mide los adaptadores y deja el piso intacto', (t) => {
    // Split estricto/laxo: en un workspace instalado los adaptadores existen
    // pero pueden diferir, y el piso histórico no es un hecho sobre AOI.
    //
    // `fileURLToPath`, NO `new URL(...).pathname`: la ruta del repo tiene un
    // espacio y el pathname lo entrega como `%20`, con lo que `existsSync`
    // falla en silencio y el test pasaría por la razón equivocada. Ver A.3.
    const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
    if (!fs.existsSync(path.join(REPO, 'setup.sh'))) {
      t.skip('workspace instalado: el piso no es un hecho sobre AOI')
      return
    }
    const r = auditContextBudget(REPO)
    assert.ok(r.adapters.total > 0, 'los adaptadores de este repositorio pesan, y deben medirse')
    assert.equal(r.floor, 86873, 'el piso histórico se movió: revisá si sumaste los adaptadores')
  })
})
