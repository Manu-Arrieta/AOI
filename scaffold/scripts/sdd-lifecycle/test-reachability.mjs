/**
 * scripts/sdd-lifecycle/test-reachability.mjs
 *
 * Answers one question: will a runner ever execute this test file?
 *
 * Split out of invariant-gate.mjs when that file crossed the 300 LOC of
 * Invariant 5. The boundary is real: matching contract tags against test
 * sources is a different job from deciding which of those sources are
 * reachable at all, and the second question turns out to matter to more than
 * one caller.
 *
 * A live cycle is why it exists. A delegated agent wrote
 * `app/utils/token-budget.test.ts` citing all three BIC tags; the Invariant
 * Gate matched them and reported the contract enforced. Meanwhile the
 * project's `vitest.config.ts` pinned `include` to `test/**`, so the file was
 * never collected and not one assertion ran. Every gate was green over a test
 * that did not exist as far as the runner was concerned.
 */

import fs from 'node:fs'
import path from 'node:path'
import { findOrphanTests } from '../scaffold/validate-test-globs.mjs'
import { isAoiGovernedPath, isDevelopmentRepo } from '../scaffold/governed-paths.mjs'

/** El infijo `.test.` / `.spec.`: la convención de JS, TS y Vue, y de nadie más. */
const hasTestInfix = (name) => name.includes('.test.') || name.includes('.spec.')

/**
 * Cómo se reconoce un archivo de test, POR LENGUAJE.
 *
 * **El infijo es la convención de JS, y la lista declaraba cinco lenguajes.**
 * Medido el 2026-09-23 sobre `campaign-manager`, cuyo producto es .NET: con la
 * regla del infijo sola, `.py`, `.go` y `.rs` eran entradas MUERTAS —ningún
 * archivo real de esos lenguajes las matchea— y `.cs` no estaba. El efecto no es
 * cosmético: el Invariant Gate reportaba las 22 reglas de un contrato como NO
 * CUBIERTAS con los tags presentes en los tests, así que el veredicto dependía
 * del LENGUAJE del producto y no de que existiera una prueba. Un gate que sólo
 * puede juzgar proyectos JS no es un gate.
 *
 * Medición: sembrando una convención por lenguaje y llamando a
 * `collectTestSources`, de 9 archivos se colectaban 2 —los dos de JS—.
 *
 * Cada entrada declara la convención REAL del lenguaje. La de C# mira el nombre
 * y la de Rust la carpeta, porque en Rust el marcador es el directorio.
 */
const TEST_FILE_CONVENTIONS = new Map([
  ['.mjs', hasTestInfix],
  ['.js', hasTestInfix],
  ['.ts', hasTestInfix],
  ['.tsx', hasTestInfix],
  ['.jsx', hasTestInfix],
  ['.vue', hasTestInfix],
  // pytest: `test_x.py` o `x_test.py`. Las dos formas son estándar.
  ['.py', (name) => name.startsWith('test_') || name.endsWith('_test.py') || hasTestInfix(name)],
  // Go: el sufijo es obligatorio, el toolchain no compila otro nombre como test.
  ['.go', (name) => name.endsWith('_test.go')],
  // C#: el marcador va en el SUFIJO. Producción (`Programa.cs`) no termina así,
  // y eso es lo que mantiene honesto al filtro: un archivo de `src/` no acredita.
  ['.cs', (name) => /Tests?\.cs$/.test(name)],
  // Dart: el sufijo, como en Go y en C#. `package:test` descubre los `x_test.dart`
  // y el `integration_test/` de Flutter usa la MISMA forma, así que un solo sufijo
  // cubre las dos carpetas — y la carpeta no hace falta como marcador, que es lo
  // que la distingue de Rust.
  //
  // Se agregó el 2026-09-26, y es una omisión de la primera pasada: esa corrigió
  // `.cs` —el lenguaje de `backend/`— y dejó afuera el de `frontend/`, con el
  // mismo síntoma y en el mismo repo. Medido sobre `campaign-manager`: 8 archivos
  // de `frontend/test/` con tags de contrato, invisibles para el gate.
  ['.dart', (name) => name.endsWith('_test.dart')],
  // Rust: los de integración viven bajo `tests/` con el nombre que quieran
  // (`tests/algo.rs`), y los unitarios van inline con `#[cfg(test)]`, o sea
  // DENTRO de un archivo de producción — esos no hay nada que colectar. El
  // marcador es la carpeta, con el costo declarado: un módulo auxiliar de
  // `tests/` también entra.
  ['.rs', (_name, relative) => relative.split(path.sep).includes('tests')],
])

const SKIP_DIRS = new Set(['node_modules', '.git', '.nuxt', '.output', 'dist', 'build', 'coverage'])

/**
 * ¿Este archivo, con esta ruta relativa al barrido, es un archivo de test?
 *
 * Exportada porque la pregunta ahora depende del lenguaje y tenerla aparte deja
 * fijarla con casos directos por convención. El único consumidor era el `walk`,
 * así que una tabla mal escrita se veía como "el gate no cubre nada" y no como
 * "la tabla está mal": el síntoma quedaba a tres capas del defecto.
 */
export function isTestFile(relative) {
  const name = path.basename(relative)
  const convention = TEST_FILE_CONVENTIONS.get(path.extname(name))

  return convention ? convention(name, relative) : false
}

/**
 * Los espejos, como RUTA desde la raíz del barrido — nunca como nombre de directorio.
 *
 * Un espejo copiado byte a byte no es un árbol de tests con autoridad: contarlo
 * deja que una copia satisfaga un contrato por su cuenta. Pero `scaffold` vivía
 * acá como NOMBRE, y eso es el mismo error anclado al revés que ya se pagó dos
 * veces en este repositorio —`validate-srp.mjs` con `MIRROR_DIR`, y la sonda de
 * mutación—: el espejo es `scaffold/` en la raíz, pero `scripts/scaffold/` es
 * fuente real y comparte el nombre. Medido el 2026-09-18 en este árbol: de 142
 * tests colectados, CERO eran de `scripts/scaffold/`, el área que contiene las
 * compuertas, y `BIC-2026-001:never.3` no podía acreditarse con el test que lo
 * cita ahí.
 *
 * `.conf` entra por lo medido en una instalación real el mismo día, y es el
 * defecto más grave de los dos. `setup.sh` retira `scaffold/` del destino, pero
 * `.conf/snapshots/` guarda una copia byte a byte de todo lo que AOI instaló —114
 * archivos de test— y esa copia NO cae bajo ninguna ruta gobernada, así que
 * sobrevivía al filtro de `dropAoiOwnedTests`. Con el filtro ya puesto, un
 * contrato del Owner sin una sola prueba seguía dando PASSED, acreditado por
 * `.conf/snapshots/scripts/sdd-lifecycle/behavioral-probes.test.mjs`.
 */
const MIRROR_DIRS = new Set(['scaffold', '.conf'])

/**
 * Recursively collects test file contents under a directory.
 * @param {string} dir
 * @returns {Array<{ file: string, content: string }>}
 */
export function collectTestSources(dir) {
  if (!dir || !fs.existsSync(dir)) return []

  const stat = fs.statSync(dir)
  if (stat.isFile()) {
    try {
      return [{ file: dir, content: fs.readFileSync(dir, 'utf8') }]
    } catch {
      return []
    }
  }

  const sources = []
  const walk = (current) => {
    let entries = []
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue
      const full = path.join(current, entry.name)

      if (entry.isDirectory()) {
        // Anclado a la raíz del barrido: `scripts/scaffold/` comparte nombre con
        // el espejo y no es uno.
        if (MIRROR_DIRS.has(path.relative(dir, full))) continue
        walk(full)
        continue
      }

      if (!isTestFile(path.relative(dir, full))) continue

      try {
        sources.push({ file: full, content: fs.readFileSync(full, 'utf8') })
      } catch {
        // Ignore unreadable files
      }
    }
  }

  walk(dir)
  return sources
}

/**
 * Partitions test sources into the ones a runner collects and the ones it does not.
 *
 * **Devuelve TRES estados, no dos, y el tercero es un arreglo medido.** La versión
 * anterior, ante un `package.json` ausente o ilegible, devolvía `kept: sources` —
 * o sea, *"no pude determinar la alcanzabilidad"* se trataba como *"todo es
 * alcanzable"*.
 *
 * Una verificación adversarial encontró la consecuencia: con un `package.json`
 * corrupto, un archivo que ningún runner colecta pasaba a ser **la evidencia de
 * que el contrato está enforced**, y el Invariant Gate daba PASSED. Contradecía la
 * doctrina del propio módulo unas líneas más arriba —*"unresolvable is reported,
 * never assumed reachable"*— aplicada a las specs de vitest y no al
 * `package.json`.
 *
 * `determinable: false` no decide por el llamador: le dice que la pregunta no se
 * pudo responder, y el Invariant Gate bloquea con exit 2. Seguir sin dropear nada
 * es correcto —dropear un test real por no poder preguntar sería el mismo error al
 * revés—, pero **callarlo no lo era**.
 *
 * @param {string} root repository root
 * @param {Array<{file: string, content: string}>} sources
 * @returns {{ kept: Array, dropped: string[], determinable: boolean, reason: string }}
 */
export function dropUnreachableTests(root, sources) {
  let orphans
  try {
    orphans = new Set(findOrphanTests(root).map((o) => path.resolve(root, o.file)))
  } catch (err) {
    // No package.json, o uno ilegible: la pregunta no se pudo responder. Se
    // conservan todos los fuentes —dropear un test real por no poder preguntar
    // sería el mismo error al revés— pero se declara que la respuesta es
    // INDETERMINADA, para que quien decide no la lea como un sí.
    return {
      kept: sources,
      dropped: [],
      determinable: false,
      reason: `no se pudo leer package.json para determinar alcanzabilidad (${err?.message || 'error desconocido'})`,
    }
  }

  const kept = []
  const dropped = []
  for (const s of sources) {
    if (orphans.has(path.resolve(s.file))) dropped.push(s.file)
    else kept.push(s)
  }
  return { kept, dropped, determinable: true, reason: '' }
}

/**
 * Partitions test sources into the Owner's own tests and AOI's installed ones.
 *
 * Los tags del BIC viven en un espacio de nombres plano y la cobertura se
 * resuelve con una inclusión literal de cadena, así que dos contratos que
 * comparten número son la misma cadena para el gate. En el repo de desarrollo
 * eso es correcto: ahí los `BIC-2026-00X` SON los del producto. Aguas abajo no:
 * AOI instala en `scripts/` sus propios tests, que citan sus propios tags, y un
 * BIC del producto numerado dentro del rango que AOI ya ocupa queda "cubierto"
 * por pruebas que asertan algo ajeno.
 *
 * Medido el 2026-09-18 en una instalación real: la regla *"ninguna de las dos
 * VPS acepta una sesión SSH como root"*, sin una sola prueba escrita, quedó
 * cubierta por un `it()` de AOI titulado *"charges the exact literal payload for
 * every phase"*. El veredicto dependía del NÚMERO del identificador, no de que
 * existiera un test: renumerar el mismo contrato a `BIC-2026-101` lo hacía
 * fallar. Y como `/sdd-frame` prescribe numerar desde el primer id libre, el
 * primer BIC de todo workspace nuevo cae justo en `001`.
 *
 * El criterio es el mismo que `validate-srp.mjs`, `validate-test-globs.mjs` y
 * `undocumented-commands.mjs` ya aplican: las invariantes de AOI juzgan el
 * código de AOI, no el del Owner. Quién responde esa pregunta es
 * `governed-paths.mjs`, una sola vez para las dos compuertas.
 *
 * @param {string} installRoot raíz donde AOI está instalado (o el repo fuente)
 * @param {Array<{file: string, content: string}>} sources
 * @returns {{ kept: Array, dropped: string[] }}
 */
export function dropAoiOwnedTests(installRoot, sources) {
  // En el repo fuente todo `scripts/` es código de AOI y sus BIC son los del
  // producto: filtrarlos acá dejaría al gate sin nada que medir sobre sí mismo.
  if (!installRoot || isDevelopmentRepo(installRoot)) {
    return { kept: sources, dropped: [] }
  }

  const kept = []
  const dropped = []

  for (const source of sources) {
    if (isAoiGovernedPath(installRoot, source.file)) dropped.push(source.file)
    else kept.push(source)
  }

  return { kept, dropped }
}
