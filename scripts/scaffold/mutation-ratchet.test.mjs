/**
 * scripts/scaffold/mutation-ratchet.test.mjs
 *
 * The ratchet decides whether a suite is allowed to constrain less than it
 * did yesterday, and it was the last file in `scripts/` that no test reached
 * — declared as an exemption because running it takes twenty minutes.
 *
 * That reasoning covered `main()`, which orchestrates the probe. It did not
 * cover `judge()`, which is where the decision actually lives and is a pure
 * function of three numbers. A ratchet whose comparison is wrong either
 * blocks every branch or ratchets nothing, and both look the same from
 * outside: no output.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { judge, MUTATION_FLOOR, ratchetVerdict, RUNNERS, SHELL_AREAS, TEST_GLOB } from './mutation-ratchet.mjs'

const FLOOR = { 'scripts/demo': 60 }

/**
 * `ratchetVerdict`: la decisión de salir 0 o 1.
 *
 * `judge()` compara UNA medición con su piso y estaba bien cubierto. Lo que no
 * tenía un solo caso era la pieza que decide el código de salida a partir del
 * conjunto — y sus cuatro mutantes sobrevivían, que son los cuatro más caros del
 * área: el trinquete ES la compuerta que detecta que una suite dejó de
 * restringir, así que una decisión sin atar deja la compuerta inútil.
 *
 * Los casos exigen las DOS direcciones en cada filtro, porque las dos son
 * silenciosas de maneras distintas: con `!==` el conjunto incluye veredictos que
 * no corresponden —acusa a la suite equivocada— y con una sola área el filtro
 * puede quedar vacío y NO reportar una regresión real.
 */
describe('ratchetVerdict decide el código de salida', () => {
  const R = (area, verdict, score = 50, expected = 60) => ({ area, verdict, score, expected })

  it('una sola área regresada alcanza para salir 1', () => {
    // La dirección peligrosa: con una única área en la lista, un filtro que no
    // matchee exacto deja `regressed` vacío y la regresión no se reporta.
    const v = ratchetVerdict([R('scripts/a', 'regressed')])
    assert.equal(v.regressed.length, 1)
    assert.equal(v.exitCode, 1, 'no reportó la regresión')
  })

  it('todo en su piso sale 0 y no reporta nada', () => {
    // Este caso mata `> 0` mutado a `>= 0`: con `>=` el código de salida es 1
    // SIEMPRE, incluso acá. Un trinquete que falla siempre es tan inútil como
    // uno que nunca falla: el operador aprende a ignorarlo.
    const v = ratchetVerdict([R('scripts/a', 'held'), R('scripts/b', 'held')])
    assert.equal(v.exitCode, 0, 'falló sin ninguna regresión')
    assert.deepEqual(v.regressed, [])
    assert.deepEqual(v.improved, [])
  })

  it('las mejoras no cuentan como regresiones', () => {
    // `===` mutado a `!==` en el filtro de `regressed` mete acá las mejoras y
    // las que se mantienen, y el mensaje acusa a la suite equivocada.
    const v = ratchetVerdict([R('scripts/a', 'improved', 90), R('scripts/b', 'held')])
    assert.equal(v.exitCode, 0, 'una mejora no puede bloquear')
    assert.deepEqual(v.regressed, [], 'el conjunto de regresadas incluye las que no regresaron')
    assert.equal(v.improved.length, 1, 'no reconoció la mejora')
    assert.equal(v.improved[0].area, 'scripts/a')
  })

  it('separá las dos listas cuando hay mezcla', () => {
    // El caso que distingue los dos filtros en una sola corrida: con cualquiera
    // de los dos invertido, una de las dos listas queda con el elemento
    // equivocado y la otra vacía.
    const v = ratchetVerdict([
      R('scripts/reg', 'regressed', 40),
      R('scripts/imp', 'improved', 80),
      R('scripts/ok', 'held'),
      R('scripts/sin', 'undeclared'),
    ])
    assert.deepEqual(v.regressed.map((r) => r.area), ['scripts/reg'])
    assert.deepEqual(v.improved.map((r) => r.area), ['scripts/imp'])
    assert.equal(v.exitCode, 1, 'una regresión entre cuatro áreas no bloqueó')
  })

  it('una regresión bloquea aunque haya mejoras', () => {
    // La dirección que importa: un trinquete no se compensa. Que un área suba no
    // autoriza a que otra baje.
    const v = ratchetVerdict([R('scripts/imp', 'improved', 95), R('scripts/reg', 'regressed', 10)])
    assert.equal(v.exitCode, 1, 'la mejora compensó la regresión')
  })

  it('una lista vacía sale 0', () => {
    // Correr sin áreas es distinto de correr con áreas sanas, pero ninguno de
    // los dos puede bloquear: no hay nada que haya empeorado.
    const v = ratchetVerdict([])
    assert.equal(v.exitCode, 0)
    assert.deepEqual(v.regressed, [])
  })

  it('una entrada que no es lista no explota', () => {
    // La guarda de forma: `main()` arma la lista, y un `undefined` que llegue
    // por un cambio futuro no puede tumbar la corrida con un TypeError en vez
    // del veredicto.
    for (const entrada of [undefined, null, 'no-es-lista', 42]) {
      const v = ratchetVerdict(entrada)
      assert.equal(v.exitCode, 0, `explotó o bloqueó con: ${String(entrada)}`)
      assert.deepEqual(v.regressed, [])
    }
  })
})

describe('judge compares a measurement against its floor', () => {
  it('holds when the score equals the floor exactly', () => {
    const v = judge('scripts/demo', 60, 100, FLOOR)
    assert.equal(v.score, 60)
    assert.equal(v.verdict, 'held')
  })

  it('regresses below the floor, by a single point', () => {
    // One point matters: the floor is the measured value, so any drop means
    // something that used to be constrained no longer is.
    assert.equal(judge('scripts/demo', 59, 100, FLOOR).verdict, 'regressed')
  })

  it('improves above the floor', () => {
    const v = judge('scripts/demo', 75, 100, FLOOR)
    assert.equal(v.verdict, 'improved')
    assert.equal(v.expected, 60)
  })

  it('rounds the score rather than truncating it', () => {
    // 2/3 is 66.67%. Truncating would report 66 and, against a floor of 67,
    // manufacture a regression out of arithmetic.
    assert.equal(judge('scripts/demo', 2, 3, FLOOR).score, 67)
  })

  it('reports zero for an area with no mutants instead of dividing by zero', () => {
    // A source set that produced nothing to mutate is not a perfect score.
    const v = judge('scripts/demo', 0, 0, FLOOR)
    assert.equal(v.score, 0)
    assert.equal(v.verdict, 'regressed')
  })

  it('calls an area with no declared floor undeclared, not regressed', () => {
    // A new area must be recorded deliberately; treating it as a failure
    // would push someone to add a floor without measuring it.
    const v = judge('scripts/nueva', 10, 100, FLOOR)
    assert.equal(v.verdict, 'undeclared')
    assert.equal(v.expected, undefined)
  })

  it('treats a floor of zero as a real floor, not as absent', () => {
    assert.equal(judge('scripts/cero', 0, 10, { 'scripts/cero': 0 }).verdict, 'held')
  })
})

describe('the shipped configuration', () => {
  it('declares a floor for every area between 0 and 100', () => {
    const areas = Object.entries(MUTATION_FLOOR)
    assert.ok(areas.length >= 12, `sólo ${areas.length} áreas declaradas`)
    for (const [area, floor] of areas) {
      assert.ok(Number.isInteger(floor), `${area}: el piso no es entero`)
      assert.ok(floor >= 0 && floor <= 100, `${area}: piso fuera de rango (${floor})`)
    }
  })

  it('builds a test glob from the area path', () => {
    assert.equal(TEST_GLOB('scripts/demo'), 'scripts/demo/*.test.mjs')
  })

  it('gives every custom runner a command and a working directory', () => {
    // A runner missing its cwd runs vitest from the repository root, where
    // it finds no config and reports zero tests — a clean baseline failure
    // that looks like a broken suite.
    for (const [area, runner] of Object.entries(RUNNERS)) {
      assert.ok(MUTATION_FLOOR[area] !== undefined, `${area} tiene runner y no tiene piso`)
      assert.equal(typeof runner.command, 'string')
      assert.ok(Array.isArray(runner.args) && runner.args.length > 0)
      assert.equal(typeof runner.cwd, 'string')
    }
  })

  it('declares the shell areas it knows about', () => {
    for (const area of SHELL_AREAS) {
      assert.ok(MUTATION_FLOOR[area] !== undefined, `${area} figura como shell y no tiene piso`)
    }
  })
})
