/**
 * scripts/sdd-lifecycle/stress-suite.test.mjs
 *
 * The instrument that measures everything else, measured.
 *
 * `sdd-stress-suite.mjs` produces the savings figure that every branch in
 * this repository is judged by — the number recorded as the benchmark
 * baseline, compared cycle over cycle, and cited in every closeout. It had no
 * test of any kind: 283 lines that no runner ever loaded.
 *
 * That is the worst place in the project for a silent defect. A gate that
 * breaks makes noise. A ruler that is wrong just reports a number, and the
 * number IS the evidence, so nobody goes looking behind it.
 *
 * The suite is a procedural script with nothing to import, so the test runs
 * it and checks the claims it makes about itself: that the arithmetic closes,
 * that no phase reports a negative saving, that every phase is accounted for,
 * and — the one that matters most — that it measured REAL artifacts rather
 * than quietly falling back to fixtures.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { before, describe, it } from 'node:test'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '../..')
const SUITE = path.join(HERE, 'sdd-stress-suite.mjs')

/** Digits with thousands separators, as the report prints them. */
const num = (s) => Number(String(s).replace(/[.,\s]/g, ''))

let output = ''
let code = 0
let fidelity = { real: 0, fixture: 0, omitted: 0 }

before(() => {
  try {
    output = execFileSync('node', [SUITE], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      timeout: 300000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    code = e.status ?? 1
    output = String(e.stdout ?? '') + String(e.stderr ?? '')
  }
})

/** One row per phase, as the per-phase lines report it. */
function phases() {
  const rows = []
  for (const m of output.matchAll(/Phase (\d) complete: (\d+) tokens -> (\d+) tokens \(([\d.]+)% saved\) \[(\w+)\]/g)) {
    rows.push({ phase: Number(m[1]), base: Number(m[2]), aoi: Number(m[3]), pct: Number(m[4]), origin: m[5] })
  }
  return rows
}

describe('the benchmark runs and accounts for every phase', () => {
  it('exits 0 on the development repository', () => {
    assert.equal(code, 0, output.slice(-800))
  })

  it('accounts for all six phases, whatever it managed to measure', () => {
    // The fidelity line is the report's own statement about how much of the
    // product it actually exercised. It has to add up to six: a phase that
    // vanishes from the accounting is a phase nobody knows went unmeasured.
    const m = output.match(/Fidelidad: (\d+) fase\(s\) medidas sobre artefactos reales · (\d+) sobre fixtures · (\d+) omitidas/)
    assert.ok(m, 'el reporte no declara su fidelidad')
    const [real, fixture, omitted] = [Number(m[1]), Number(m[2]), Number(m[3])]
    assert.equal(real + fixture + omitted, 6, `la fidelidad suma ${real + fixture + omitted}, no seis`)
    fidelity = { real, fixture, omitted }
  })

  it('prints one line per phase it measured, and none for a phase it skipped', () => {
    const rows = phases()
    assert.equal(
      rows.length,
      fidelity.real + fidelity.fixture,
      `imprimió ${rows.length} fases y declaró ${fidelity.real + fidelity.fixture} medidas`
    )
    assert.deepEqual([...new Set(rows.map((r) => r.phase))].length, rows.length, 'repitió una fase')
  })

  it('labels every measurement with where its numbers came from', () => {
    // The degradation to fixtures must never be silent: this repository has
    // no task on disk, so the fallback genuinely fires here, and the report
    // saying `[fixture]` out loud is what keeps the baseline honest. A run
    // whose origins were all unlabelled would look identical to a real one.
    const rows = phases()
    assert.ok(rows.length > 0)
    for (const r of rows) {
      assert.ok(['real', 'fixture'].includes(r.origin), `Fase ${r.phase} sin origen declarado`)
    }
    assert.equal(rows.filter((r) => r.origin === 'real').length, fidelity.real)
    assert.equal(rows.filter((r) => r.origin === 'fixture').length, fidelity.fixture)
  })
})

describe('the arithmetic closes', () => {
  it('never reports a phase that costs more optimised than raw', () => {
    // A negative saving printed as a positive percentage is the failure mode
    // that would flatter every number downstream.
    for (const r of phases()) {
      assert.ok(r.aoi <= r.base, `Fase ${r.phase}: AOI ${r.aoi} > base ${r.base}`)
    }
  })

  it('matches each phase percentage to its own numbers', () => {
    for (const r of phases()) {
      const expected = ((r.base - r.aoi) / r.base) * 100
      assert.ok(
        Math.abs(expected - r.pct) < 0.1,
        `Fase ${r.phase}: dice ${r.pct}% y sus números dan ${expected.toFixed(1)}%`
      )
    }
  })

  it('totals exactly the sum of the phases', () => {
    // The executive summary is what gets copied into the baseline table, so
    // it has to be the phases added up and not a separately computed figure.
    const rows = phases()
    const base = num(output.match(/Consumo Base Estimado:\s+([\d.,]+)/)[1])
    const aoi = num(output.match(/Consumo AOI:\s+([\d.,]+)/)[1])
    const saved = num(output.match(/AHORRO TOTAL:\s+([\d.,]+)/)[1])

    assert.equal(base, rows.reduce((s, r) => s + r.base, 0))
    assert.equal(aoi, rows.reduce((s, r) => s + r.aoi, 0))
    assert.equal(saved, base - aoi, 'el ahorro total no es la resta de sus propios totales')
  })

  it('matches the headline percentage to the headline numbers', () => {
    const base = num(output.match(/Consumo Base Estimado:\s+([\d.,]+)/)[1])
    const aoi = num(output.match(/Consumo AOI:\s+([\d.,]+)/)[1])
    const pct = Number(output.match(/de reducción neta/) && output.match(/\(([\d.]+)% de reducción neta\)/)[1])
    assert.ok(Math.abs(((base - aoi) / base) * 100 - pct) < 0.1)
  })
})

describe('the fixed infrastructure cost is reported and internally consistent', () => {
  it('reports a floor and a ceiling, with the ceiling no lower', () => {
    // FLOOR is what every cycle pays; CEILING adds everything conditional. A
    // ceiling below the floor would mean the conditional surfaces were
    // subtracted instead of added.
    const floor = num(output.match(/PISO, se paga en todo ciclo:\s+([\d.,]+)/)[1])
    const ceiling = num(output.match(/TECHO, si además dispara todo lo condicional:\s+([\d.,]+)/)[1])
    assert.ok(floor > 0, 'el piso dio cero: no midió ninguna superficie inyectada')
    assert.ok(ceiling >= floor, `techo ${ceiling} por debajo del piso ${floor}`)
  })

  it('dwarfs the variable payload, which is the finding the floor exists to keep visible', () => {
    // The optimisers work on the variable payload, and it is a small part of
    // what a cycle actually costs. Losing this comparison is how the project
    // would start congratulating itself on the 6% it controls.
    const floor = num(output.match(/PISO, se paga en todo ciclo:\s+([\d.,]+)/)[1])
    const aoi = num(output.match(/Consumo AOI:\s+([\d.,]+)/)[1])
    assert.ok(floor > aoi * 5, `piso ${floor} no domina el payload ${aoi}`)
  })

  it('audits the prompt cache and reports zero violations', () => {
    assert.match(output, /Scanned \d+ prompt templates: \d+ passed, 0 violations/)
  })
})
