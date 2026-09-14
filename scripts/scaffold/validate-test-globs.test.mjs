import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, after } from 'node:test'
import {
  auditTestGlobs,
  collectTestGlobs,
  expandGlob,
  findOwningPackage,
  stripComments,
} from './validate-test-globs.mjs'

/** La raíz del repositorio, para los casos que corren el CLI en un hijo. */
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * Directorios descartables, borrados al cerrar el módulo.
 *
 * Acumulados y no limpiados caso por caso porque el helper se invoca inline y
 * no hay variable por test donde borrar. Medido: 9 directorios por corrida
 * quedaban en `$TMPDIR` para siempre.
 */
const temporales = []
after(() => {
  for (const dir of temporales) fs.rmSync(dir, { recursive: true, force: true })
})

/** Builds a throwaway workspace with a package.json and optional test files. */
function workspace({ scripts, files = [], devRepo = false }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-globs-'))
  temporales.push(root)
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts }))
  if (devRepo) fs.writeFileSync(path.join(root, 'setup.sh'), '#!/usr/bin/env bash\n')
  for (const rel of files) {
    const full = path.join(root, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, 'export const x = 1')
  }
  return root
}

describe('collectTestGlobs', () => {
  it('finds every glob across chained commands and ignores flags', () => {
    const globs = collectTestGlobs({
      'test:a': 'node --test scripts/a/*.test.mjs',
      'test:b': 'node scripts/lint.mjs && node --test --test-reporter=spec scripts/b/*.test.mjs',
      build: 'tsc -p .',
    })

    assert.deepEqual(globs.map((g) => g.glob), ['scripts/a/*.test.mjs', 'scripts/b/*.test.mjs'])
  })

  it('captures every file in a multi-file invocation', () => {
    const globs = collectTestGlobs({ 'test:x': 'node --test a/one.test.mjs a/two.test.mjs' })
    assert.equal(globs.length, 2)
  })
})

describe('expandGlob', () => {
  it('reports a directory that does not exist as absent, not empty', () => {
    const root = workspace({ scripts: {} })
    const result = expandGlob(root, 'scripts/missing/*.test.mjs')

    assert.equal(result.dirExists, false)
    assert.deepEqual(result.matches, [])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('matches only files the pattern selects', () => {
    const root = workspace({ scripts: {}, files: ['s/a.test.mjs', 's/b.test.mjs', 's/helper.mjs'] })
    const result = expandGlob(root, 's/*.test.mjs')

    assert.deepEqual(result.matches.map((m) => path.basename(m)).sort(), ['a.test.mjs', 'b.test.mjs'])
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('auditTestGlobs', () => {
  it('fails in the dev repo when a declared glob matches nothing', () => {
    // The exact shape that shipped: the directory is gone, node --test exits 0.
    const root = workspace({ scripts: { 'test:conf': 'node --test scripts/conf/*.test.mjs' }, devRepo: true })
    const report = auditTestGlobs(root)

    assert.equal(report.strict, true)
    assert.equal(report.empty.length, 1)
    assert.equal(report.empty[0].script, 'test:conf')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('tolerates a directory an installed workspace legitimately lacks', () => {
    const root = workspace({ scripts: { 'test:conf': 'node --test scripts/conf/*.test.mjs' } })
    const report = auditTestGlobs(root)

    assert.equal(report.strict, false)
    assert.equal(report.empty.length, 0)
    assert.equal(report.absent.length, 1)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('still fails an installed workspace whose existing suite was emptied', () => {
    // Erosion, not absence: the directory is there and the tests are gone.
    const root = workspace({ scripts: { 'test:x': 'node --test s/*.test.mjs' }, files: ['s/helper.mjs'] })
    const report = auditTestGlobs(root)

    assert.equal(report.strict, false)
    assert.equal(report.empty.length, 1)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('passes when every declared glob resolves', () => {
    const root = workspace({ scripts: { 'test:x': 'node --test s/*.test.mjs' }, files: ['s/a.test.mjs'], devRepo: true })
    const report = auditTestGlobs(root)

    assert.equal(report.empty.length, 0)
    assert.equal(report.checked, 1)
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('el modo lenient distingue ausente de vaciado, y lo dice', () => {
  // La distincion es la razon de ser de los dos modos: un directorio que solo
  // existe para probar al instalador legitimamente no se envia, mientras que un
  // directorio presente y sin tests es erosion real. Confundirlos vuelve inutil
  // al gate en el unico sitio donde el producto corre de verdad.
  it('tolera un glob cuyo directorio no llego a la instalacion', () => {
    const root = workspace({ scripts: { 'test:conf': 'node --test scripts/conf/*.test.mjs' } })
    const r = auditTestGlobs(root)

    assert.equal(r.strict, false, 'sin setup.sh en la raiz deberia ser una instalacion')
    assert.deepEqual(r.empty, [], 'un directorio no instalado no es un glob vacio')
    assert.deepEqual(r.absent.map((a) => a.glob), ['scripts/conf/*.test.mjs'])
  })

  it('sigue fallando si el directorio existe y quedo sin tests', () => {
    const root = workspace({
      scripts: { 'test:conf': 'node --test scripts/conf/*.test.mjs' },
      files: ['scripts/conf/helper.mjs'],
    })
    const r = auditTestGlobs(root)

    assert.deepEqual(r.absent, [], 'el directorio esta: no puede reportarse como no instalado')
    assert.deepEqual(r.empty.map((e) => e.glob), ['scripts/conf/*.test.mjs'])
  })

  it('en el repo de desarrollo un directorio ausente es una falla, no una tolerancia', () => {
    const root = workspace({ scripts: { 'test:conf': 'node --test scripts/conf/*.test.mjs' }, devRepo: true })
    const r = auditTestGlobs(root)

    assert.equal(r.strict, true)
    assert.deepEqual(r.empty.map((e) => e.glob), ['scripts/conf/*.test.mjs'])
  })
})

/**
 * `stripComments`, con casos directos.
 *
 * Es la función que más mutantes sobrevivía del módulo: doce, y con razón. Su
 * único consumidor es `collectVitestIncludes`, y una mutación que no cambia el
 * GLOB que sale del config no cambia nada aguas abajo — así que las ramas del
 * escáner no tenían NINGUNA entrada que las distinguiera. El probe lo midió: de
 * los 42 mutantes de este archivo, doce sobrevivían y todos caían acá.
 *
 * Las aserciones son de igualdad EXACTA y no de "contiene", porque lo que estas
 * ramas producen es una cadena de la MISMA longitud con las posiciones
 * reemplazadas por espacios: un `includes` pasa con el comentario sin borrar.
 * Los valores salen de medir la salida real, no de deducirla.
 */
describe('stripComments', () => {
  it('preserva la longitud, que es lo que mantiene alineados los offsets', () => {
    // La propiedad que el docblock declara. Es lo que permite usar el resultado
    // para calcular posiciones sobre el texto original.
    //
    // Este caso encontró un defecto real: la versión anterior emitía el `\n`
    // final de un comentario de línea SIEMPRE, así que un comentario al final
    // del texto, sin salto, alargaba la salida en un carácter. Medido:
    // `x = 1 // c` de 10 pasaba a 11. La invariante declarada era falsa en el
    // borde y ninguna prueba lo veía, porque el único consumidor tolera un
    // carácter de más.
    for (const t of ['a // b', 'x = 1 // c', 'a/b // c', 'a /* b */ c', 'a /* b', 'sin comentarios', '']) {
      assert.equal(stripComments(t).length, t.length, `cambió la longitud de: ${JSON.stringify(t)}`)
    }
  })

  it('un comentario de línea al final, sin salto, no agrega un carácter', () => {
    // El borde exacto del defecto de arriba, aislado para que un cambio futuro
    // no lo reintroduzca por la puerta de atrás.
    assert.equal(stripComments('x = 1 // c'), 'x = 1     ')
    assert.equal(stripComments('// sola'), '       ')
    // Con salto, el `\n` sí se emite: es parte del original.
    assert.equal(stripComments('a // b\nc'), 'a     \nc')
  })

  it('no trata una barra sola como comentario', () => {
    // La dirección más peligrosa: si el escáner cree que hay un comentario donde
    // no lo hay, borra configuración real. `a/b` no tiene ningún comentario.
    //
    // Este caso solo mata CUATRO mutantes de la línea 138 —los dos `eq→ne` y el
    // `and→or`— y el `and→or` de la 147, porque es la única entrada que
    // distingue "hay `//`" de "hay una barra seguida de algo".
    assert.equal(stripComments('a/b'), 'a/b')
    assert.equal(stripComments('a/b // c'), 'a/b     ')
  })

  it('no come el `**` de un glob entre comillas, que es el uso real', () => {
    // El docblock cuenta que la primera versión rompía el glob `test/**/*.test.ts`
    // al confundir `/**` con un comentario de bloque. La versión con conciencia
    // de strings lo resuelve PORQUE el glob va entre comillas en el config real
    // —verificado en `aoi_apps/agentic-ops-dashboard/vitest.config.ts`, que
    // declara `include: ['test/**/*.test.ts']`— así que este caso fija que el
    // manejo de strings siga existiendo.
    const quoted = "include: ['test/**/*.test.ts']"
    assert.equal(stripComments(quoted), quoted)
    assert.equal(stripComments('include: ["test/**/*.test.ts"]'), 'include: ["test/**/*.test.ts"]')
  })

  it('borra un comentario de bloque completo, sin comerse lo que viene después', () => {
    // Distingue `i < stop` de `i <= stop`: con `<=` la iteración de más alcanza
    // el carácter que sigue al bloque y lo borra. Por eso la aserción exige que
    // la `b` final sobreviva.
    assert.equal(stripComments('a /*x*/b'), 'a      b')
    assert.equal(stripComments('a /* hi */ b'), 'a          b')
    assert.equal(stripComments('x/y/*z*/w'), 'x/y     w')
  })

  it('preserva los saltos de línea dentro de un comentario de bloque', () => {
    // Distingue el ternario `text[i] === '\n' ? '\n' : ' '`: invertido, los
    // saltos se vuelven espacios y los demás caracteres saltos — la salida deja
    // de tener la forma del original y los números de línea se corren.
    assert.equal(stripComments('a /* x\ny */ b'), 'a     \n     b')
  })

  it('cierra un bloque sin cerrar al final del texto', () => {
    // Distingue `end === -1 ? text.length : end + 2`: con `!==` la rama del
    // `-1` —un bloque que nunca se cierra— dejaría `stop` en 1, el `for` no
    // correría y el comentario quedaría SIN borrar.
    assert.equal(stripComments('a /* x'), 'a     ')
    assert.equal(stripComments('/* sola'), '       ')
  })

  it('una barra al final sin nada después no inventa un comentario', () => {
    // `text[i + 1]` fuera de rango es `undefined`, que no es `'/'` ni `'*'`.
    // Sin este caso, un mutante que trate el final como coincidencia borraría la
    // última barra.
    assert.equal(stripComments('a/'), 'a/')
    assert.equal(stripComments('/'), '/')
  })

  it('un comentario de línea sin salto final igual termina', () => {
    // Distingue `while (i < text.length && ...)` de `<=`: con `<=` el bucle pisa
    // `text[length]`, que es `undefined`, y sigue. Y distingue el `for` de la
    // 119, donde la iteración de más agrega la cadena `'undefined'` a la salida.
    assert.equal(stripComments('x = 1 // c'), 'x = 1     ')
  })
})

/**
 * La guarda de CLI, por spawn.
 *
 * `if (process.argv[1] && path.resolve(...) === path.resolve(...))` tiene dos
 * mitades y las dos son invisibles importando el módulo: `main()` no corre, así
 * que ninguna aserción sobre las funciones exportadas las toca. Un `and→or` las
 * desactiva y el módulo pasa a ejecutarse al importarse, que es exactamente el
 * defecto que la guarda existe para evitar.
 */
describe('la guarda de CLI', () => {
  const CORRER = (args) => {
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 30000, cwd: REPO })
    return `${r.stdout ?? ''}${r.stderr ?? ''}`
  }

  it('importar el módulo NO ejecuta la auditoría', () => {
    // Bajo `and→or` sobre la guarda, `process.argv[1]` alcanza: el import corre
    // `main()` y la auditoría imprime su cabecera.
    const out = CORRER(['-e', "import('./scripts/scaffold/validate-test-globs.mjs')"])
    assert.doesNotMatch(out, /AOI Test Glob Coverage/, `el import ejecutó main(): ${out.slice(0, 200)}`)
  })

  it('correrlo como script SÍ ejecuta la auditoría y sale 0', () => {
    // La otra mitad: una guarda que nunca dispara también es un defecto, porque
    // el script deja de hacer su trabajo.
    const out = CORRER(['scripts/scaffold/validate-test-globs.mjs'])
    assert.match(out, /AOI Test Glob Coverage/, `no ejecutó la auditoría: ${out.slice(0, 200)}`)
    assert.match(out, /Every declared test glob resolves/, 'no trajo el resumen de modo estricto')
  })

  it('en el repo de desarrollo el resumen es el de modo estricto, no el tolerante', () => {
    // Distingue `absent.length > 0` de `>= 0`: con `>=` la condición es siempre
    // verdadera y el resumen cambia al de modo lenient aunque no haya ningún
    // glob ausente. El repo tiene `setup.sh`, así que es estricto y no hay
    // ausentes.
    const out = CORRER(['scripts/scaffold/validate-test-globs.mjs'])
    assert.match(out, /strict \(development repository\)/)
    assert.doesNotMatch(out, /de 15 globs resuelven/, 'dio el resumen tolerante sin globs ausentes')
  })
})

/**
 * Un superviviente que NO se puede atar con un caso, y por qué.
 *
 * `findOwningPackage` tiene `while (dir !== '.' && dir !== path.sep)`, y su
 * mutante `and→or` solo cambia el comportamiento en la rama donde NO se
 * encuentra ningún `package.json`: con `||` la condición queda verdadera para
 * siempre y `path.dirname('.')` es `'.'`, así que el bucle no termina nunca.
 *
 * Es decir que la única entrada que lo distingue lo hace COLGAR, y un bucle
 * sincrónico infinito no lo corta el `timeout` de `node:test` — bloquea el
 * event loop y cuelga la corrida entera. Un caso así cambiaría un superviviente
 * por un test que cuelga la suite, que es peor.
 *
 * El probe sí lo mata: su `suitePasses` mata por timeout desde afuera. En la
 * corrida completa del 2026-09-13 este mutante sobrevivió igual, lo que sugiere
 * que el glob de tests no llega a la rama sin `package.json` — pero forzarla acá
 * sería introducir el cuelgue. Queda declarado, que es la regla para esta clase.
 */
describe('findOwningPackage: rama que no se puede atar', () => {
  it('encuentra el ancestro cuando existe', () => {
    // Esto es lo que SÍ se puede fijar: el camino que termina. La rama que
    // cuelga queda documentada arriba y no se ejercita.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-owner-'))
    try {
      fs.mkdirSync(path.join(root, 'x/y'), { recursive: true })
      fs.writeFileSync(path.join(root, 'x/package.json'), '{}')
      assert.equal(findOwningPackage(root, path.join('x/y/f.mjs')), 'x')
      assert.equal(findOwningPackage(root, path.join('x/package.json')), 'x')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
