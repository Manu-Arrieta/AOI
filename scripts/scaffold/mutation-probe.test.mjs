/**
 * scripts/scaffold/mutation-probe.test.mjs
 *
 * The probe measures whether a suite constrains its code, so a defect in the
 * probe corrupts every number it reports. Its first version mutated the
 * contents of string literals, and a separator like `'============'` contains
 * `===`: those mutants changed a banner, survived everything, and inflated
 * the survivor count with findings that were not about logic at all.
 */

import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, after } from 'node:test'
import {
  GHOST_MARK,
  isGhostToReap,
  literalMask,
  mutationsFor,
  OPERATORS,
  reapGhosts,
  suitePasses,
} from './mutation-probe.mjs'

describe('mutations are generated only where a decision is made', () => {
  it('mutates a real comparison', () => {
    const m = mutationsFor('if (a === b) return 1')
    assert.equal(m.length, 1)
    assert.equal(m[0].operator, 'eq→ne')
    assert.match(m[0].mutated, /a !== b/)
  })

  it('produces one mutation per operator occurrence', () => {
    // Two independent decisions on one line means two separate mutants; a
    // single mutant changing both would not tell us which one is unchecked.
    assert.equal(mutationsFor('if (a === b && c === d) return 1').length, 3)
  })

  const INSIDE_LITERALS = [
    ['a template separator', 'push(`================`)'],
    ['a single-quoted string', "const s = 'a === b'"],
    ['a double-quoted string', 'const s = "x && y"'],
    ['a trailing comment', 'const n = 1 // a === b'],
    ['a whole-line comment', '  // if (a === b) return true'],
  ]
  for (const [what, line] of INSIDE_LITERALS) {
    it(`ignores ${what}`, () => {
      assert.deepEqual(mutationsFor(line), [], `mutó dentro de: ${line}`)
    })
  }

  it('still mutates code that sits beside a literal', () => {
    const m = mutationsFor("const s = 'a === b'; if (x === y) {}")
    assert.equal(m.length, 1)
    assert.match(m[0].mutated, /x !== y/)
    assert.match(m[0].mutated, /'a === b'/, 'tocó el literal además del código')
  })

  it('handles an escaped quote without losing track of the string', () => {
    // A naive scanner ends the string at the escaped quote and then treats
    // the rest of the line as code.
    assert.deepEqual(mutationsFor("const s = 'no \\' termina === aca'"), [])
  })

  it('reports the line number and the original text', () => {
    const m = mutationsFor('const a = 1\nif (b === c) {}')
    assert.equal(m[0].line, 2)
    assert.equal(m[0].before, 'if (b === c) {}')
  })
})

/**
 * El contrato de `suitePasses`, que hasta ahora no tenía un solo caso directo.
 *
 * Importa más de lo que parece: el probe termina por dos vías —el timeout o el
 * evento `exit` del hijo— y matar el grupo de procesos en UNA sola de las dos
 * deja vivos a los procesos que la suite lanzó. Medido el 2026-09-13: trece
 * huérfanos, hasta cuatro horas girando, y el probe reportando esos mutantes
 * como muertos —correctamente— mientras la máquina quedaba al 100%.
 *
 * Los casos usan un NIETO de verdad, porque el nieto es lo que se filtraba: el
 * hijo directo siempre moría. Un caso que sólo mira al hijo no distingue un
 * arreglo de una fuga.
 */
describe('a suite leaves no process behind, by either exit', () => {
  const SANDBOXES = []
  after(() => {
    for (const d of SANDBOXES) fs.rmSync(d, { recursive: true, force: true })
  })

  /**
   * Un directorio con una suite que lanza un proceso fantasma.
   * @param {'hang'|'exit'} kind si la suite además se cuelga o termina
   */
  function fixture(kind) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-probe-ghost-'))
    SANDBOXES.push(dir)
    const mark = `ghost-${process.pid}-${Math.random().toString(36).slice(2, 8)}`
    // El fantasma tiene que estar VIVO, no ocupado. Antes esto era
    // `while (true) {}`, que lo mantiene vivo al precio de quemar un núcleo
    // entero — y el único caso en que importa es justamente el que se fugó:
    // medido con `ps`, un fantasma filtrado por una corrida de mutación se
    // quedaba girando para siempre, seis de ellos a 594% de CPU en una máquina
    // de 12 núcleos. Un intervalo referenciado mantiene el proceso vivo igual
    // —que es lo único que el caso necesita— y cuesta 0.0% medido. Ocupar CPU
    // nunca fue parte de lo que el caso verifica.
    fs.writeFileSync(path.join(dir, `${mark}.mjs`), 'setInterval(() => {}, 1000)\n')
    fs.writeFileSync(
      path.join(dir, 'suite.test.mjs'),
      [
        "import { spawn } from 'node:child_process'",
        "import path from 'node:path'",
        "import { fileURLToPath } from 'node:url'",
        "import { test } from 'node:test'",
        "test('launches a ghost', async () => {",
        '  const here = path.dirname(fileURLToPath(import.meta.url))',
        // El fantasma se deja en `unref` —su vida no la sostiene el padre, que
        // es justamente lo que hay que recoger— y el caso `hang` se sostiene
        // con un intervalo propio. Esa separación es la que hace que cada caso
        // mida su camino: sin el intervalo, una suite sin nada pendiente hace
        // que el runner salga por su cuenta y el caso del reloj mediría una
        // salida temprana; con el fantasma referenciado, el caso `exit` no
        // terminaría nunca y mediría un timeout.
        `  spawn(process.execPath, [path.join(here, '${mark}.mjs')], { stdio: 'ignore' }).unref()`,
        kind === 'hang' ? '  setInterval(() => {}, 1000)' : '',
        kind === 'hang' ? '  await new Promise(() => {})' : '',
        '})',
        '',
      ].join('\n')
    )
    return { dir, mark }
  }

  /** Cuántos procesos con la marca siguen vivos; espera a que bajen a cero. */
  async function alive(mark) {
    for (let i = 0; i < 12; i++) {
      const out = execFileSync('ps', ['-Ao', 'args'], { encoding: 'utf8' })
      const n = out.split('\n').filter((l) => l.includes(mark)).length
      if (n === 0) return 0
      await new Promise((r) => setTimeout(r, 100))
    }
    return 1
  }

  /** Un fantasma que sobrevive no puede quedar suelto entre casos. */
  function reap(mark) {
    const out = execFileSync('ps', ['-Ao', 'pid,args'], { encoding: 'utf8' })
    for (const line of out.split('\n')) {
      if (!line.includes(mark)) continue
      try {
        process.kill(Number(line.trim().split(/\s+/)[0]), 'SIGKILL')
      } catch {}
    }
  }

  /**
   * El valor esperado NO es decorativo: es lo que prueba por qué camino salió.
   * En el caso `exit` el timeout es largo a propósito, así que pasar significa
   * que la suite terminó sola y el grupo se mató igual. Sin esa aserción el caso
   * podría estar midiendo el camino del timeout dos veces y seguiría verde.
   */
  const CASES = [
    ['hang', false, 1200, 'se cuelga y el timeout la corta'],
    ['exit', true, 10000, 'termina sola'],
  ]

  for (const [kind, expected, timeout, label] of CASES) {
    it(`kills the group when the suite ${label}`, async () => {
      const { dir, mark } = fixture(kind)
      try {
        const startedAt = Date.now()
        const passed = await suitePasses(dir, '*.test.mjs', timeout)
        const elapsed = Date.now() - startedAt
        assert.equal(passed, expected, `la suite no salió por donde el caso pretende (${label})`)
        // El reloj es lo que distingue el camino del timeout de una salida
        // temprana del runner. `false` lo producen LOS DOS, así que sin esta
        // aserción el caso medía una salida temprana creyendo medir el reloj —
        // y el mutante que convierte `finish(false)` en `finish(true)`
        // sobrevivía en la versión donde el runner sale antes.
        if (kind === 'hang') {
          assert.ok(
            elapsed >= timeout * 0.8,
            `salió en ${elapsed}ms y el timeout es de ${timeout}ms: no fue el reloj, fue una salida temprana del runner`
          )
        }
        const left = await alive(mark)
        assert.equal(left, 0, `quedó vivo el nieto: la suite ${label} y no se recogió el grupo`)
      } finally {
        reap(mark)
      }
    })
  }

  it('reports pass for a green suite and failure for a red one', async () => {
    const green = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-probe-green-'))
    const red = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-probe-red-'))
    SANDBOXES.push(green, red)
    const body = (n) =>
      `import { test } from 'node:test'\nimport assert from 'node:assert/strict'\ntest('t', () => assert.equal(1, ${n}))\n`
    fs.writeFileSync(path.join(green, 'suite.test.mjs'), body(1))
    fs.writeFileSync(path.join(red, 'suite.test.mjs'), body(2))

    assert.equal(await suitePasses(green, '*.test.mjs', 10000), true, 'una suite verde no reportó pass')
    assert.equal(await suitePasses(red, '*.test.mjs', 10000), false, 'una suite roja no reportó fallo')
  })
})

/**
 * `reapGhosts` es la red que recoge lo que la ruta mutada deja suelto.
 *
 * El fixture lanza un proceso vivo y el test lo mata por grupo de procesos.
 * Cuando el probe corta la suite mutada por timeout —que es lo que hace cuando
 * el mutante rompe la limpieza— el `finally` no llega a correr y el fantasma
 * sobrevive a su padre. Es inherente: lo que se muta es justamente la ruta que
 * lo recoge.
 *
 * El fantasma ya no cuesta CPU —el fixture lo mantiene con un intervalo
 * inactivo y no con un bucle ocupado, medido 0.0% contra 99.7%— pero un proceso
 * por mutante que se acumule sigue siendo un problema, así que se recoge desde
 * afuera del código mutado.
 */
describe('reapGhosts', () => {
  const GHOST_DIRS = []
  after(() => {
    for (const d of GHOST_DIRS) fs.rmSync(d, { recursive: true, force: true })
  })

  /**
   * La guarda, con una entrada por rama.
   *
   * Cada caso existe porque su mutante sobrevivía cuando la guarda estaba
   * inline en el bucle: `isInteger(pid) && pid > 0` mutado a `||` sólo se
   * distingue con un pid que sea entero Y cero, y `pid !== selfPid` mutado a
   * `===` sólo con el pid propio. Sin estas entradas, el área medía 61 en vez
   * de 62 y la compuerta tenía razón: la lógica estaba sin atar.
   */
  const SELF = 4242
  const GHOST_PATH = `/tmp/${GHOST_MARK}abc/ghost-1.mjs`
  const GHOSTS = [
    ['una línea de ps normal', 900, GHOST_PATH, true],
    ['el pid propio, que no se puede recoger solo', SELF, GHOST_PATH, false],
    ['un pid cero', 0, GHOST_PATH, false],
    ['un pid negativo', -1, GHOST_PATH, false],
    ['un primer campo que no es un número', 'x', GHOST_PATH, false],
    ['una línea sin la marca', 900, '/tmp/otra-cosa.mjs', false],
  ]

  for (const [what, pid, args, expected] of GHOSTS) {
    it(`${expected ? 'recoge' : 'ignora'} ${what}`, () => {
      assert.equal(isGhostToReap(`${pid} node ${args}`, SELF), expected)
    })
  }

  it('la marca se busca en toda la línea, no solo al principio', () => {
    // `ps` pone el pid primero, así que la marca nunca está al inicio de la
    // línea. Un `startsWith` la perdería entera.
    assert.equal(isGhostToReap(`900 node ${GHOST_PATH}`, SELF), true)
  })

  const countMark = (mark) =>
    execFileSync('ps', ['-Ao', 'args'], { encoding: 'utf8' })
      .split('\n')
      .filter((l) => l.includes(mark)).length

  const waitFor = async (fn, want, tries = 50) => {
    for (let i = 0; i < tries; i++) {
      if (fn() === want) return true
      await new Promise((r) => setTimeout(r, 100))
    }
    return fn() === want
  }

  /** Un proceso vivo con un nombre elegido, para no depender del fixture. */
  function liveProcess(prefix) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-probe-reap-'))
    GHOST_DIRS.push(dir)
    const mark = `${prefix}${process.pid}-${Math.random().toString(36).slice(2, 8)}`
    const file = path.join(dir, `${mark}.mjs`)
    // Inactivo a propósito: el caso mide si se lo recoge, no cuánta CPU quema.
    fs.writeFileSync(file, 'setInterval(() => {}, 1000)\n')
    const child = spawn(process.execPath, [file], { stdio: 'ignore' })
    return { child, mark }
  }

  it('termina un proceso que lleva la marca del fixture', async () => {
    const { child, mark } = liveProcess(GHOST_MARK)
    try {
      assert.ok(await waitFor(() => countMark(mark), 1), 'el proceso de prueba no llegó a arrancar')
      assert.ok(reapGhosts() >= 1, 'no recogió un fantasma que estaba vivo')
      assert.ok(await waitFor(() => countMark(mark), 0), 'el fantasma siguió vivo después de recogerlo')
    } finally {
      child.kill('SIGKILL')
    }
  })

  it('no toca un proceso que no lleva la marca', async () => {
    // La dirección peligrosa: un reaper que mata por parecido se lleva puestos
    // procesos de otra corrida o de otro programa.
    const { child, mark } = liveProcess('aoi-not-a-ghost-')
    try {
      assert.ok(await waitFor(() => countMark(mark), 1), 'el proceso de prueba no llegó a arrancar')
      reapGhosts()
      assert.equal(countMark(mark), 1, 'mató un proceso que no era un fantasma')
    } finally {
      child.kill('SIGKILL')
    }
  })
})

describe('literalMask', () => {
  it('marks the quoted region and nothing else', () => {
    const mask = literalMask("x = 'ab'; y")
    assert.equal(mask[0], false) // x
    assert.equal(mask[4], true) // opening quote
    assert.equal(mask[5], true) // a
    assert.equal(mask[7], true) // closing quote
    assert.equal(mask[10], false) // y
  })

  it('marks everything after a line comment starts', () => {
    const mask = literalMask('x = 1 // resto')
    assert.equal(mask[0], false)
    assert.equal(mask.at(-1), true)
  })
})

describe('the operator set', () => {
  it('pairs every inversion with its opposite, so neither direction is blind', () => {
    const names = OPERATORS.map((o) => o.name)
    for (const [a, b] of [['eq→ne', 'ne→eq'], ['and→or', 'or→and'], ['true→false', 'false→true']]) {
      assert.ok(names.includes(a) && names.includes(b), `falta el par ${a}/${b}`)
    }
  })

  it('every operator actually changes the line it matches', () => {
    for (const op of OPERATORS) {
      op.find.lastIndex = 0
      assert.notEqual(op.replace, op.find.source, `${op.name} no cambia nada`)
    }
  })
})
