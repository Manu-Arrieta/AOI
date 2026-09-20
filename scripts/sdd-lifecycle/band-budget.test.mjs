/**
 * scripts/sdd-lifecycle/band-budget.test.mjs
 *
 * El trinquete tiene cinco reglas y cada una cierra un modo de falla distinto.
 * Un test que sólo probara la banda real no probaría ninguna: pasaría por
 * vacuidad, porque hoy la banda coincide con su baseline.
 *
 * La función es PURA y recibe la banda como argumento, así que cada regla se
 * ejercita con una entrada y sin tocar un archivo real. Esa es la diferencia
 * entre una decisión alcanzable y una que vive dentro de un `main()` y sólo se
 * puede medir matando el proceso.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { BAND_BUDGET, BAND_CEILING, auditBandBudget } from './band-budget.mjs'

/**
 * Una banda mínima y válida contra un baseline mínimo, para aislar cada regla.
 *
 * El techo es HOLGADO a propósito. Con uno ajustado al baseline, mover un archivo
 * para ejercitar la regla 1 hace que la regla 4 dispare también, y el test no
 * puede atribuir el hallazgo a la regla que dice probar — falla la aserción de
 * longitud por una razón que no tiene nada que ver. Pasó en la primera corrida:
 * `150 + 200 = 350 > 300`, dos hallazgos donde se esperaba uno.
 */
const BASE = { 'a.md': 100, 'b.md': 200 }
const CEIL = 10_000
const band = (over = {}) => [
  { source: 'a.md', tokens: 100, multiplier: 7, cycleTokens: 700, ...over.a },
  { source: 'b.md', tokens: 200, multiplier: 7, cycleTokens: 1400, ...over.b },
]

describe('la banda que coincide con su baseline no produce hallazgos', () => {
  it('el caso base: sin hallazgos', () => {
    assert.deepEqual(auditBandBudget(band(), BASE, CEIL), [])
  })
})

describe('regla 1 — crece: el crecimiento silencioso', () => {
  it('un archivo que sube se reporta con su costo x multiplicador', () => {
    // El modo de falla que el repositorio ya pagó: `context-budget.mjs` lo dice
    // en su propio docstring — "nothing failed when a prompt gained four hundred
    // tokens". Cuatrocientos tokens universales son 2.800 por ciclo, para
    // siempre, y las 26 compuertas seguían verdes.
    const r = auditBandBudget(band({ a: { tokens: 150 } }), BASE, CEIL)
    assert.equal(r.length, 1)
    assert.match(r[0], /^GREW\s+a\.md/)
    assert.match(r[0], /150 tok, era 100/)
    // 50 de más, x7 = 350. Sin el multiplicador en el mensaje, quien lo lee no
    // sabe cuánto cuesta de verdad.
    assert.match(r[0], /\+350 por ciclo/)
  })

  it('no reporta STALE BUDGET en el mismo archivo (las reglas son excluyentes)', () => {
    const r = auditBandBudget(band({ a: { tokens: 150 } }), BASE, CEIL)
    assert.ok(!r.some((x) => x.includes('STALE BUDGET')), `no debe haber STALE: ${JSON.stringify(r)}`)
  })
})

describe('regla 2 — encoge: el ahorro que se evapora', () => {
  it('un archivo que baja exige bajar el presupuesto en el mismo commit', () => {
    // Sin esta regla, un recorte NO queda capturado: el baseline sigue en 100 y
    // el archivo puede volver a crecer hasta 100 con la guarda en verde. Es la
    // razón de ser del trinquete, y la diferencia con un cap.
    const r = auditBandBudget(band({ a: { tokens: 60 } }), BASE, CEIL)
    assert.equal(r.length, 1)
    assert.match(r[0], /^STALE BUDGET\s+a\.md bajó a 60/)
    assert.match(r[0], /bajá el presupuesto en este commit/)
  })
})

describe('regla 3 — entra: el modo de falla más caro', () => {
  it('un archivo que no está en el baseline se reporta como nuevo en la banda', () => {
    // Una instruction cuyo `applyTo` pasa a matchear `**` entra a la banda x7
    // EN SILENCIO. Es el modo más caro que existe hoy, y el único que ninguna de
    // las cuatro guardas anteriores podía ver: no hay cap que se cruce cuando el
    // archivo es nuevo.
    const universal = [...band(), { source: 'nueva.instructions.md', tokens: 500, multiplier: 7, cycleTokens: 3500 }]
    const r = auditBandBudget(universal, BASE, CEIL)
    assert.ok(r.some((x) => /^NEW IN BAND\s+nueva\.instructions\.md/.test(x)), JSON.stringify(r))
  })
})

describe('regla 4 — techo: la evasión agregada', () => {
  it('el total por encima del techo se reporta aunque cada archivo entre', () => {
    // Ocho archivos que bajan 10 tokens cada uno para que uno suba 200. Ninguna
    // regla por archivo lo ve. El techo ajustado se pasa EXPLÍCITO: es el único
    // caso donde debe apretar.
    const universal = [
      { source: 'a.md', tokens: 100, multiplier: 7, cycleTokens: 700 },
      { source: 'b.md', tokens: 250, multiplier: 7, cycleTokens: 1750 },
    ]
    const r = auditBandBudget(universal, BASE, 300)
    assert.ok(r.some((x) => /^BAND CEILING\s+350 > 300/.test(x)), JSON.stringify(r))
    // Y la regla por archivo no dispara: b.md subió, así que GREW también está.
    // Se fija para que quede claro que el techo es un hallazgo ADICIONAL.
    assert.ok(r.some((x) => /^GREW\s+b\.md/.test(x)), JSON.stringify(r))
  })

  it('y no lo reporta cuando el total entra en el techo', () => {
    const universal = [
      { source: 'a.md', tokens: 100, multiplier: 7, cycleTokens: 700 },
      { source: 'b.md', tokens: 200, multiplier: 7, cycleTokens: 1400 },
    ]
    assert.ok(!auditBandBudget(universal, BASE, CEIL).some((x) => x.includes('BAND CEILING')))
  })
})

describe('regla 5 — sale: la entrada huérfana', () => {
  it('un archivo del baseline que ya no está en la banda se reporta', () => {
    // `validate-srp.mjs` ya tiene esta forma con STALE BUDGET. Un baseline que
    // conserva una entrada muerta miente sobre lo que vigila.
    const r = auditBandBudget([band()[0]], BASE, CEIL)
    assert.ok(r.some((x) => /^REMOVED FROM BAND\s+b\.md/.test(x)), JSON.stringify(r))
  })
})

describe('el baseline del repositorio, y sus invariantes', () => {
  it('los ocho archivos de la banda están en el baseline', () => {
    assert.equal(Object.keys(BAND_BUDGET).length, 8)
  })

  it('el techo declarado es la suma exacta del baseline', () => {
    // Si el techo y la suma de las entradas discreparan, una de las dos miente y
    // la regla 4 mediría contra un número que nadie mantiene.
    const suma = Object.values(BAND_BUDGET).reduce((n, v) => n + v, 0)
    assert.equal(suma, BAND_CEILING)
  })

  it('los tres archivos más caros suman el 69,5% de la banda, como dice el plan', () => {
    // La medición que ordena las prioridades del plan de recorte. Si cambia,
    // cambió el objetivo y hay que releer §5.1.
    const ordenados = Object.values(BAND_BUDGET).sort((a, b) => b - a)
    const tresGrandes = ordenados.slice(0, 3).reduce((n, v) => n + v, 0)
    assert.equal(tresGrandes, 6575)
    assert.equal(Math.round((tresGrandes / BAND_CEILING) * 1000) / 10, 69.5)
  })

  it('ningún valor del baseline es cero', () => {
    // Un cero registrado haría que cualquier archivo real se reporte como GREW.
    for (const [k, v] of Object.entries(BAND_BUDGET)) assert.ok(v > 0, `${k} tiene baseline 0`)
  })
})
