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
  assertEnoughMemory,
  availableMemoryMB,
  GHOST_MARK,
  ghostPidToReap,
  literalMask,
  MUTANT_HEAP_MB,
  mutationsFor,
  NO_PID,
  OPERATORS,
  parseVmStat,
  reapGhosts,
  reapStaleSuites,
  suiteFailureTail,
  suitePasses,
  suitesPidFile,
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

  it('no muta dentro de un literal de regex', () => {
    // El caso que causo 21 abortos por OOM el 2026-09-13. El operador `and→or`
    // declara su patron como `/ && /g`, y ese `&&` vive dentro de un literal.
    // Sin taparlo, el operador se mutaba a SI MISMO y el resultado era
    // `/ || /g`.
    assert.deepEqual(mutationsFor("  { find: / && /g, replace: ' || ' },"), [])
  })

  it('termina aunque un operador matchee la cadena vacia', () => {
    // La regresion directa del OOM. `/ || /` NO busca el texto ` || `: los `|`
    // son alternancia y la rama del medio esta vacia, asi que el patron matchea
    // la cadena vacia en cualquier posicion. Con flag `g` un match de longitud
    // cero no avanza `lastIndex`.
    //
    // Sin el guardian de `mutationsFor` este caso NO vuelve: acumula `out.push`
    // hasta que el proceso aborta por `FatalProcessOutOfMemory`. Que este test
    // termine es la asercion, y el tope de tamano es la segunda: la rama de
    // espacio si matchea con longitud 1 y genera un mutante por espacio, pero
    // nunca una cantidad que dependa de cuantas veces gire el bucle.
    const emptyBranch = [{ name: 'rama-vacia', find: / || /g, replace: ' || ' }]
    const r = mutationsFor('if (a === b) return 1', emptyBranch)
    assert.ok(Array.isArray(r), 'no volvio: el while no termino')
    assert.ok(r.length < 100, `genero ${r.length} mutantes y no esta acotado por la linea`)
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
  const MARKS = [GHOST_MARK]
  const GHOST_PATH = `/tmp/${GHOST_MARK}abc/ghost-1.mjs`
  const GHOSTS = [
    ['una línea de ps normal', 900, GHOST_PATH, 900],
    ['el pid propio, que no se puede recoger solo', SELF, GHOST_PATH, NO_PID],
    // El pid 1 es el proceso más destructivo que se puede matar, y es el único
    // que distingue `pid <= 1` de `pid < 1`. Sin este caso, el mutante que
    // afloja la guarda a `< 1` autoriza a `launchd`, y no hay nada más que lo
    // note: en una corrida real `pid 1` nunca lleva la marca, así que el
    // agujero quedaría latente hasta que alguien recogiera fantasmas con una
    // tabla de procesos que sí lo tuviera marcado.
    ['el pid 1, que es launchd', 1, GHOST_PATH, NO_PID],
    ['un pid cero', 0, GHOST_PATH, NO_PID],
    ['un pid negativo', -1, GHOST_PATH, NO_PID],
    ['un primer campo que no es un número', 'x', GHOST_PATH, NO_PID],
    ['una línea sin la marca', 900, '/tmp/otra-cosa.mjs', NO_PID],
  ]

  for (const [what, pid, args, expected] of GHOSTS) {
    it(`${expected === NO_PID ? 'ignora' : 'recoge'} ${what}`, () => {
      assert.equal(ghostPidToReap(`${pid} node ${args}`, MARKS, SELF), expected)
    })
  }

  it('la marca se busca en toda la línea, no solo al principio', () => {
    // `ps` pone el pid primero, así que la marca nunca está al inicio de la
    // línea. Un `startsWith` la perdería entera.
    assert.equal(ghostPidToReap(`900 node ${GHOST_PATH}`, MARKS, SELF), 900)
  })

  it('sin marcas declaradas no autoriza ningún pid', () => {
    // La dirección segura: un llamador que se olvide del argumento deja
    // fantasmas vivos, y eso se nota; al revés mataría procesos ajenos en
    // silencio. Es el caso que hace que `marks` vacío no sea "matar todo".
    assert.equal(ghostPidToReap(`900 node ${GHOST_PATH}`, [], SELF), NO_PID)
    assert.equal(ghostPidToReap(`900 node ${GHOST_PATH}`, undefined, SELF), NO_PID)
  })

  it('el número de procesos que autoriza es acotado, no la tabla entera', () => {
    // El caso que falla si el predicado se vuelve peligroso, y el que faltaba
    // cuando esto mató aplicaciones del Owner.
    //
    // El probe se mide a sí mismo, así que este predicado recibe mutantes
    // `true→false` y `&&→||`. En su versión booleana, el mutante que convierte
    // su `return false` en `return true` lo hacía matchear 492 de 492 líneas
    // de `ps`, incluido `pid 1`, y `reapGhosts` recorría la tabla de procesos
    // mandándole SIGKILL a cada uno.
    //
    // Un predicado que devuelve un PID sólo puede autorizar UNO por línea. Si
    // alguna mutación volviera esto "todo", acá se ve: la cantidad de pids
    // autorizados no puede superar la de líneas que llevan la marca.
    const ps = execFileSync('ps', ['-Ao', 'pid,args'], { encoding: 'utf8' })
    const lines = ps.split('\n').filter(Boolean)
    const marked = lines.filter((l) => l.includes(GHOST_MARK)).length
    const authorized = lines.filter((l) => ghostPidToReap(l, MARKS, SELF) !== NO_PID).length
    assert.equal(
      authorized,
      marked,
      `autorizó ${authorized} de ${lines.length} líneas contra ${marked} con la marca`
    )
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

  it('tapa un literal de regex, para que un operador no se mute a si mismo', () => {
    const line = "  { name: 'and→or', find: / && /g, replace: ' || ' },"
    const mask = literalMask(line)
    const at = line.indexOf(' && ')
    assert.equal(mask[at], true, 'el && dentro de / && /g quedo expuesto a mutacion')
    // El `/` que abre y el `g` que cierra tambien quedan dentro.
    assert.equal(mask[line.indexOf('/ && /')], true, 'no tapo el delimitador de apertura')
  })

  it('no confunde una division con un literal de regex', () => {
    // La direccion peligrosa de la heuristica: tapar una division esconderia
    // un sitio real de mutacion y bajaria el conteo sin que nada lo diga.
    const line = 'const ratio = total / count'
    const mask = literalMask(line)
    assert.equal(mask[line.indexOf('/')], false, 'tapo una division')
  })

  it('respeta una clase de caracteres con una barra adentro', () => {
    // `/[/]/g`: la barra de adentro de `[...]` no cierra el literal. Sin
    // respetar la clase el cierre quedaria en la barra equivocada, el `g`
    // quedaria fuera del enmascarado y una mutacion podria caer ahi.
    const line = 'const re = /[/]/g'
    const mask = literalMask(line)
    assert.equal(mask[line.indexOf('/[/]/')], true, 'no tapo la apertura')
    assert.equal(mask[line.lastIndexOf('/')], true, 'no tapo la barra de cierre')
    assert.equal(mask.at(-1), false, 'el flag quedo adentro del literal')
  })
})

/**
 * La precondición de memoria.
 *
 * El probe corre en la máquina del operador y sus mutantes pueden asignar sin
 * freno. Medido el 2026-09-13: con la máquina al 91% de uso, el pico de memoria
 * de una corrida alcanzó para que el sistema empiece a terminar procesos
 * ajenos —el Owner lo vio como "se cerraron todas las aplicaciones"— mientras
 * el probe seguía midiendo como si nada. Un instrumento que daña el entorno
 * donde mide no es un instrumento, y la única defensa que tiene el probe sobre
 * eso es negarse a arrancar cuando sabe que no hay lugar.
 *
 * `assertEnoughMemory` y `availableMemoryMB` se fijan con casos directos por la
 * misma razón que `suitePasses`: la decisión se puede atar, el efecto no.
 */
describe('precondición de memoria', () => {
  it('corta cuando hay menos que el mínimo', () => {
    assert.throws(
      () => assertEnoughMemory(2048, () => 300),
      /Memoria reclamable insuficiente/,
      'no cortó con 300 MB contra un mínimo de 2048'
    )
  })

  it('deja pasar cuando alcanza, y devuelve lo que midió', () => {
    assert.equal(assertEnoughMemory(2048, () => 9000), 9000)
  })

  it('el borde exacto pasa', () => {
    // La dirección peligrosa de un `<` mal puesto: cortar una corrida que sí
    // entraba deja al operador sin medición y sin saber por qué.
    assert.equal(assertEnoughMemory(2048, () => 2048), 2048)
  })

  it('en esta máquina mide algo plausible', () => {
    const mb = availableMemoryMB()
    assert.ok(Number.isFinite(mb), `no devolvió un número: ${mb}`)
    assert.ok(mb > 0, `devolvió ${mb} MB, que no puede ser`)
    // Cota superior: la RAM física. Un error de unidades (páginas contra
    // bytes) daría un número enorme y la precondición dejaría de cortar nunca.
    const totalMB = Math.round(os.totalmem() / 1048576)
    assert.ok(mb <= totalMB, `devolvió ${mb} MB y la máquina tiene ${totalMB} MB`)
  })

  it('el techo de heap deja margen sobre el uso real medido', () => {
    // Medido: la suma de TODOS los procesos de `node --test` de una corrida
    // normal pico en 322 MB, así que uno solo queda muy por debajo. El techo
    // tiene que estar cómodo por arriba de eso: uno demasiado bajo haría morir
    // mutantes legítimos por memoria y los contaría como muertos, que infla el
    // score en la dirección peligrosa.
    assert.ok(
      MUTANT_HEAP_MB >= 384,
      `el techo de ${MUTANT_HEAP_MB} MB queda demasiado cerca del pico medido (322 MB)`
    )
  })
})

/**
 * El parseo de `vm_stat`, con valores EXACTOS y no "plausibles".
 *
 * Los tres mutantes de esta función —los dos `||` de los fallbacks y el `> 0`—
 * sobrevivían cuando la lectura y el parseo vivían en la misma función, porque
 * `vm_stat` siempre contesta bien en macOS y el camino de fallback nunca se
 * recorría. Un test que sólo pide "un número plausible" no distingue un fallback
 * bien puesto de uno roto.
 *
 * La fixture imita la salida real, con el tamaño de página declarado y los
 * números terminados en punto como los emite macOS.
 */
describe('parseVmStat', () => {
  const vmStat = (pageSize, free, inactive, speculative) =>
    [
      `Mach Virtual Memory Statistics: (page size of ${pageSize} bytes)`,
      `Pages free:                          ${free}.`,
      'Pages active:                       434628.',
      `Pages inactive:                    ${inactive}.`,
      `Pages speculative:                 ${speculative}.`,
    ].join('\n')

  it('usa el tamaño de página que declara la salida, no el de por defecto', () => {
    // Distingue `|| 4096` de `&& 4096`: con `&&` el tamaño quedaría siempre en
    // 4096 y el resultado sería distinto, porque acá la salida declara 16384.
    // 3500 páginas × 16384 / 1 MiB = 54,7 -> 55
    assert.equal(parseVmStat(vmStat(16384, 1000, 2000, 500)), 55)
    // El mismo conteo con páginas de 4096 da 13,7 -> 14
    assert.equal(parseVmStat(vmStat(4096, 1000, 2000, 500)), 14)
  })

  it('suma las tres bandas reclamables, no sólo la libre', () => {
    // Distingue `|| 0` de `&& 0` en el contador: con `&&` cada banda daría 0 y
    // el total sería 0, no 55. Y fija que `Pages free` sola no alcanza, que es
    // el motivo por el que la función existe.
    const libre = parseVmStat(vmStat(16384, 1000, 0, 0))
    const todas = parseVmStat(vmStat(16384, 1000, 2000, 500))
    assert.ok(todas > libre, `sumar las bandas no cambió el resultado: ${todas} vs ${libre}`)
    assert.equal(todas, 55)
  })

  it('un contador ausente cuenta como cero, no como uno', () => {
    // Con páginas de 1 MiB un solo contador mal sumado cambia el resultado en
    // MB, que es lo que hace distinguible este caso. Con el tamaño real de
    // macOS (16 KiB) una página de más se pierde en el redondeo y el mutante
    // sobrevive: el caso tiene que elegir la escala donde la diferencia se ve.
    const soloLibre = [
      'Mach Virtual Memory Statistics: (page size of 1048576 bytes)',
      'Pages free:                          1000.',
    ].join('\n')
    assert.equal(parseVmStat(soloLibre), 1000)
    const conInactiva = [soloLibre, 'Pages inactive:                       250.'].join('\n')
    assert.equal(parseVmStat(conInactiva), 1250)
  })

  it('cae al tamaño de página por defecto si la salida no lo declara', () => {
    // 3500 × 4096 / 1 MiB = 13,7 -> 14. Si el default no se aplicara, el
    // `undefined` daría NaN y el test lo vería.
    const sinDeclarar = [
      'Pages free:                          1000.',
      'Pages inactive:                      2000.',
      'Pages speculative:                    500.',
    ].join('\n')
    assert.equal(parseVmStat(sinDeclarar), 14)
    assert.equal(parseVmStat(sinDeclarar, 16384), 55)
  })

  it('devuelve 0 cuando la salida no trae los contadores', () => {
    assert.equal(parseVmStat(''), 0)
    assert.equal(parseVmStat('algo que no es vm_stat'), 0)
    assert.equal(parseVmStat('Mach Virtual Memory Statistics: (page size of 16384 bytes)'), 0)
  })

  it('sin contadores cae al fallback, no lo trata como medición válida', () => {
    // Distingue `mb > 0` de `mb >= 0`. El cero significa "la salida no traía
    // los contadores", no "hay cero memoria": tratarlo como medición válida
    // haría que la precondición corte siempre, incluso en una máquina sana.
    //
    // El fallback se INYECTA. La versión anterior comparaba contra una lectura
    // de `os.freemem()` hecha por el test, o sea contra OTRA lectura de una
    // métrica viva. En macOS `os.freemem()` está cacheado y las dos coincidían;
    // en Linux lee en cada llamada y la aserción es flaky. Medido el
    // 2026-09-13: `pnpm test` pasaba local y el trinquete fallaba en CI.
    assert.equal(availableMemoryMB(() => vmStat(16384, 0, 0, 0), () => 1234), 1234)
    assert.equal(availableMemoryMB(() => '', () => 4321), 4321)
    assert.equal(availableMemoryMB(() => 'nada', () => 0), 0)
  })

  it('con contadores devuelve la medición, no el fallback', () => {
    assert.equal(availableMemoryMB(() => vmStat(16384, 1000, 2000, 500), () => 9999), 55)
  })

  it('si la sonda lanza, cae al fallback en vez de propagar', () => {
    // Sin inyectar el fallback esto también compara una lectura viva contra
    // otra, y es flaky por la misma razón que el caso de arriba.
    assert.equal(
      availableMemoryMB(() => {
        throw new Error('vm_stat no existe')
      }, () => 777),
      777
    )
  })
})

/**
 * `suiteFailureTail`: el diagnóstico que faltaba cuando el baseline falla.
 *
 * `suitePasses` corre los hijos con `stdio: 'ignore'`, así que el único mensaje
 * de un baseline roto era "la suite ya falla sin mutar". Medido el 2026-09-13:
 * un commit pasó `pnpm test` en macOS y rompió el trinquete en Linux, y el log
 * de CI no alcanzaba para saber cuál de los diez archivos del área falló.
 */
describe('suiteFailureTail', () => {
  const TAILS = []
  after(() => {
    for (const d of TAILS) fs.rmSync(d, { recursive: true, force: true })
  })

  const area = (archivos) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-tail-'))
    TAILS.push(dir)
    for (const [nombre, cuerpo] of Object.entries(archivos)) {
      fs.writeFileSync(path.join(dir, nombre), cuerpo)
    }
    return dir
  }

  const ROJO = `import { test } from 'node:test'
import assert from 'node:assert/strict'
test('falla a proposito', () => assert.equal(1, 2, 'mensaje unico del test'))
`
  const VERDE = `import { test } from 'node:test'
import assert from 'node:assert/strict'
test('pasa', () => assert.equal(1, 1))
`

  it('trae la falla con su mensaje, que es lo que el log de CI no mostraba', () => {
    const tail = suiteFailureTail(area({ 'rojo.test.mjs': ROJO }), '*.test.mjs', 60000)
    assert.match(tail, /mensaje unico del test/, `no nombró la falla: ${tail.slice(0, 200)}`)
    assert.match(tail, /# fail 1/, `no trajo el resumen: ${tail.slice(0, 200)}`)
  })

  it('conserva el mensaje del bloque YAML, que un filtro por líneas destruye', () => {
    // La regresión más fina: `error: |-` es una cabecera de bloque y el mensaje
    // está en la línea SIGUIENTE, sin ningún patrón que lo delate. Un filtro
    // línea por línea deja la cabecera huérfana y pierde el contenido.
    const tail = suiteFailureTail(area({ 'rojo.test.mjs': ROJO }), '*.test.mjs', 60000)
    assert.match(tail, /error: \|-/, 'no trajo la cabecera del bloque')
    assert.match(tail, /mensaje unico del test/, 'trajo la cabecera pero perdió el contenido')
  })

  it('una suite verde devuelve su resumen sin fallas', () => {
    const tail = suiteFailureTail(area({ 'verde.test.mjs': VERDE }), '*.test.mjs', 60000)
    assert.match(tail, /# pass 1/, `no trajo el resumen: ${tail.slice(0, 200)}`)
    assert.doesNotMatch(tail, /mensaje unico/, 'reportó una falla en una suite verde')
  })

  it('avisa en vez de devolver vacío cuando no hay tests', () => {
    // Un glob que no matchea nada hace que `node --test` salga 0 sin correr
    // nada: la dirección peligrosa es reportar eso como "sin fallas".
    const tail = suiteFailureTail(area({}), '*.test.mjs', 60000)
    assert.ok(tail.length > 0, 'devolvió vacío')
    assert.match(tail, /no imprimió nada|# tests 0/, `no avisó: ${tail.slice(0, 200)}`)
  })

  it('respeta el tope de tamaño sin perder la falla', () => {
    // El fixture tiene VARIAS fallas para que la salida sea bastante más larga
    // que el tope: con una sola el contraste es de 700 contra 640 chars y el
    // caso no probaría nada. El tope elegido (600) es el menor que alcanza el
    // mensaje de la primera falla, que cae alrededor del 40% de la salida.
    const varias = Array.from(
      { length: 6 },
      (_, i) => `test('falla ${i}', () => assert.equal(1, 2, 'mensaje unico ${i}'))`
    ).join('\n')
    const fixture = `import { test } from 'node:test'
import assert from 'node:assert/strict'
${varias}
`
    const completo = suiteFailureTail(area({ 'rojo.test.mjs': fixture }), '*.test.mjs', 60000)
    const corto = suiteFailureTail(area({ 'rojo.test.mjs': fixture }), '*.test.mjs', 60000, null, 600)
    assert.ok(corto.length <= 700, `no respetó el tope: ${corto.length} chars`)
    assert.ok(
      corto.length < completo.length / 2,
      `el tope no recortó lo suficiente: ${corto.length} vs ${completo.length}`
    )
    assert.match(corto, /mensaje unico 0/, 'el recorte se llevó la primera falla')
    assert.match(corto, /# fail 6/, 'el recorte se llevó el resumen')
  })
})

describe('reapStaleSuites recoge lo que dejó una corrida muerta', () => {
  const FILES = []
  after(() => {
    for (const f of FILES) fs.rmSync(f, { force: true })
  })

  const anota = (dueno, pids) => {
    const file = suitesPidFile(dueno)
    FILES.push(file)
    fs.writeFileSync(file, pids.join('\n') + '\n')
    return file
  }

  /**
   * Un pid que con certeza NO existe, y se espera a que deje de existir.
   *
   * La primera versión lanzaba el proceso, lo mataba y devolvía el pid. Fallaba
   * por una carrera: `kill` retorna antes de que el proceso desaparezca, así que
   * `process.kill(pid, 0)` todavía contestaba que sí y `reapStaleSuites` lo veía
   * vivo — correctamente, según lo que le decían. El test era el racy, no el
   * código.
   */
  const pidMuerto = async () => {
    const p = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' })
    const n = p.pid
    p.kill('SIGKILL')
    for (let i = 0; i < 100; i++) {
      try {
        process.kill(n, 0)
      } catch {
        return n
      }
      await new Promise((r) => setTimeout(r, 20))
    }
    return n
  }

  it('un dueño muerto con un pid inexistente no explota y no rompe nada', async () => {
    // El caso central, y sin depender del timing de procesos: el dueño no existe,
    // el pid anotado tampoco, y la función tiene que devolver 0 en vez de tirar.
    anota(await pidMuerto(), [await pidMuerto()])
    assert.equal(typeof reapStaleSuites(), 'number')
  })

  it('no toca el archivo de un dueño que sigue vivo', async () => {
    // La dirección peligrosa: matar por estar anotado por otro. El archivo de
    // este proceso —que está vivo— tiene que quedar intacto.
    const file = anota(process.pid, [await pidMuerto()])
    const antes = fs.readFileSync(file, 'utf8')
    reapStaleSuites()
    assert.equal(fs.readFileSync(file, 'utf8'), antes, 'borró el pidfile de un dueño vivo')
  })

  it('borra el pidfile de un dueño muerto, para no reintentar en cada corrida', async () => {
    const file = anota(await pidMuerto(), [await pidMuerto()])
    reapStaleSuites()
    assert.ok(!fs.existsSync(file), 'dejó el pidfile de un dueño muerto')
  })

  it('ignora un pidfile con contenido que no son números', async () => {
    // Un archivo corrupto no puede tumbar la corrida ni, peor, hacer que se
    // mate un pid por accidente.
    const file = suitesPidFile(await pidMuerto())
    FILES.push(file)
    fs.writeFileSync(file, 'basura\n\n-1\n0\n')
    assert.equal(typeof reapStaleSuites(), 'number')
  })

  it('el nombre del pidfile lleva el pid del dueño', () => {
    // Dos corridas en paralelo no pueden compartir archivo: la segunda
    // recogería las suites de la primera, que está viva y midiendo.
    assert.match(suitesPidFile(1234), /aoi-probe-suites\.1234$/)
    assert.notEqual(suitesPidFile(1), suitesPidFile(2))
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
