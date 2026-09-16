#!/usr/bin/env node
/**
 * scripts/scaffold/mutation-probe.mjs
 *
 * Asks a suite the only question that distinguishes coverage from
 * verification: if this line were wrong, would anything notice?
 *
 * A test that loads a module proves it parses. A test that asserts on its
 * output proves it answers correctly for the inputs chosen. Neither shows
 * that a given line is CONSTRAINED — that changing it breaks something. This
 * changes it and finds out.
 *
 * A surviving mutant is one of two things, and both are worth knowing: a line
 * nothing checks, or an equivalent mutant — a change with no observable
 * effect through the public surface. The second kind is documented rather
 * than chased; the first is a hole.
 *
 * Usage:
 *   node scripts/scaffold/mutation-probe.mjs <area-dir> <test-glob> [--limit N]
 *
 * Runs entirely on a copy under the system temp directory. The repository is
 * never mutated.
 */

import { execFileSync, spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/**
 * Textual mutations, chosen for a low rate of equivalent mutants: each one
 * inverts a decision the code makes rather than perturbing a value.
 */
export const OPERATORS = [
  { name: 'eq→ne', find: /===/g, replace: '!==' },
  { name: 'ne→eq', find: /!==/g, replace: '===' },
  { name: 'and→or', find: / && /g, replace: ' || ' },
  { name: 'or→and', find: / \|\| /g, replace: ' && ' },
  { name: 'gt→gte', find: / > /g, replace: ' >= ' },
  { name: 'lt→lte', find: / < /g, replace: ' <= ' },
  { name: 'true→false', find: /\btrue\b/g, replace: 'false' },
  { name: 'false→true', find: /\bfalse\b/g, replace: 'true' },
]

/**
 * The same question asked of shell.
 *
 * The installer machinery is where the most destructive defects of this audit
 * lived, and it is written in bash, so leaving it unmeasured left the worst
 * code in the project outside the only check that asks whether its tests
 * constrain anything. These are bash's spellings of the same decisions:
 * string and numeric comparison, the two logical connectives, and the file
 * and emptiness tests that every guard in `compare-install.sh` is built from.
 */
export const SHELL_OPERATORS = [
  { name: 'sh:eq→ne', find: / == /g, replace: ' != ' },
  { name: 'sh:ne→eq', find: / != /g, replace: ' == ' },
  { name: 'sh:and→or', find: / && /g, replace: ' || ' },
  { name: 'sh:or→and', find: / \|\| /g, replace: ' && ' },
  { name: 'sh:-eq→-ne', find: / -eq /g, replace: ' -ne ' },
  { name: 'sh:-ne→-eq', find: / -ne /g, replace: ' -eq ' },
  { name: 'sh:-gt→-ge', find: / -gt /g, replace: ' -ge ' },
  { name: 'sh:-z→-n', find: /\[ -z /g, replace: '[ -n ' },
  { name: 'sh:-n→-z', find: /\[ -n /g, replace: '[ -z ' },
  { name: 'sh:-f→!-f', find: /\[ -f /g, replace: '[ ! -f ' },
  { name: 'sh:-d→!-d', find: /\[ -d /g, replace: '[ ! -d ' },
]

/** Which operator set applies to a file, by extension. */
export function operatorsFor(file) {
  return file.endsWith('.sh') ? SHELL_OPERATORS : OPERATORS
}

/** Lines that are comment noise rather than logic. */
function isSkippable(line) {
  const t = line.trim()
  return t === '' || t.startsWith('//') || t.startsWith('#') || t.startsWith('*') || t.startsWith('/*')
}

/**
 * Posiciones dentro de un string, un template literal, un comentario de linea,
 * o un LITERAL DE REGEX.
 *
 * Sin esto el probe muta el contenido de los strings, y un separador como
 * `'================='` contiene `===`. Esos mutantes cambian un banner y nada
 * mas, asi que sobreviven a toda suite e inflan el conteo de supervivientes con
 * hallazgos que no son sobre la logica del codigo — la medicion estaria
 * reportando sobre si misma.
 *
 * Los literales de regex entraron por una razon medida. El operador `and→or`
 * declara su patron como `/ && /g`, y ese `&&` vive DENTRO de un literal. Sin
 * taparlo el operador se muta a si mismo: `/ && /g` pasa a `/ || /g`. Y `/ || /`
 * no significa "el texto ` || `": los `|` son alternancia, y la rama del medio
 * esta VACIA, asi que el patron matchea la cadena vacia en cualquier posicion.
 * Con flag `g` un match de longitud cero no avanza `lastIndex`, el `while` de
 * `mutationsFor` no termina, `out.push` acumula sin freno y el proceso hijo
 * aborta por OOM. Medido el 2026-09-13: 21 crash reports de `node` en un dia,
 * todos `FatalProcessOutOfMemory`, con la presion de memoria suficiente para
 * que el sistema operativo empiece a matar procesos ajenos al probe.
 */
export function literalMask(line) {
  const mask = new Array(line.length).fill(false)
  let quote = null
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quote) {
      mask[i] = true
      if (c === '\\') {
        if (i + 1 < line.length) mask[i + 1] = true
        i += 1
      } else if (c === quote) {
        quote = null
      }
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
      mask[i] = true
      continue
    }
    if ((c === '/' && line[i + 1] === '/') || c === '#') {
      for (let j = i; j < line.length; j++) mask[j] = true
      break
    }
    if (c === '/' && opensRegex(line, i)) {
      const end = regexEnd(line, i)
      if (end !== -1) {
        for (let j = i; j <= end; j++) mask[j] = true
        i = end
        continue
      }
    }
  }
  return mask
}

/**
 * Si el `/` de `i` abre un literal de regex en vez de ser una division.
 *
 * Es heuristica porque la respuesta no es lexica sin un parser completo: el
 * mismo caracter es division o regex segun lo que venga antes. Alcanza con la
 * regla que usan los tokenizadores —un `/` abre un literal si el caracter
 * significativo anterior no puede terminar una expresion— y con exigir un
 * cierre, para no tapar una division real.
 */
function opensRegex(line, i) {
  let j = i - 1
  while (j >= 0 && (line[j] === ' ' || line[j] === '\t')) j -= 1
  if (j < 0) return true
  if ('(,=:[!&|?{};'.includes(line[j])) return true
  // `return /x/`, `case /x/`, `typeof /x/`...
  return /(?:^|[^A-Za-z0-9_$])(?:return|typeof|case|in|of|do|else|yield|await|void|delete|instanceof|new)$/.test(
    line.slice(0, j + 1)
  )
}

/** El indice del `/` que cierra un literal abierto en `start`, o -1. */
function regexEnd(line, start) {
  let inClass = false
  for (let i = start + 1; i < line.length; i++) {
    const c = line[i]
    if (c === '\\') {
      i += 1
      continue
    }
    if (c === '[') inClass = true
    else if (c === ']') inClass = false
    else if (c === '/' && !inClass) return i
  }
  return -1
}

/**
 * Every single-site mutation of a source file.
 * @returns {Array<{ line: number, operator: string, mutated: string, before: string }>}
 */
export function mutationsFor(source, operators = OPERATORS) {
  const lines = source.split('\n')
  const out = []
  lines.forEach((line, i) => {
    if (isSkippable(line)) return
    const masked = literalMask(line)
    for (const op of operators) {
      op.find.lastIndex = 0
      let m
      while ((m = op.find.exec(line)) !== null) {
        // Un match de longitud cero NO avanza `lastIndex` con el flag `g`, asi
        // que el `while` no termina nunca. El caso real: un patron con
        // alternancia y una rama vacia. `/ || /` no busca el texto ` || `,
        // matchea la cadena vacia en cualquier posicion. Sin este avance
        // manual el probe acumula `out.push` sin freno hasta abortar por OOM,
        // y el crash aparece como un fallo de `node` sin relacion aparente con
        // el codigo que se estaba midiendo.
        //
        // Es el guardian que hace que la sonda sea robusta a lo que su propio
        // conjunto de operadores contenga, y no solo al conjunto de hoy.
        if (m[0].length === 0) {
          op.find.lastIndex += 1
          continue
        }
        const at = m.index
        // A change inside a literal is a change to data, not to a decision.
        if (masked[at]) continue
        const mutatedLine = line.slice(0, at) + op.replace + line.slice(at + m[0].length)
        if (mutatedLine === line) continue
        const copy = [...lines]
        copy[i] = mutatedLine
        out.push({ line: i + 1, operator: op.name, mutated: copy.join('\n'), before: line.trim() })
      }
    }
  })
  return out
}

/** Sources of an area, excluding its tests. */
export const DEFAULT_EXTENSIONS = ['.mjs', '.sh', '.ts']

/** Prefijo de las copias de trabajo, con el pid del dueño a continuación. */
export const WORK_PREFIX = 'aoi-mutate-'

/**
 * Sources of an area, excluding its tests.
 *
 * `extensions` narrows what gets mutated, and the reason is a measurement the
 * probe itself distorted: extending it to shell made the `scripts` area start
 * mutating five installer helpers that live in that root and have no tests,
 * so the doctor's score collapsed from a clean 7 survivors to a reported 29%
 * that was mostly someone else's untested bash. Mixing two subjects with
 * different testing stories into one number hides both.
 */
export function areaSources(root, area, extensions = DEFAULT_EXTENSIONS) {
  const dir = path.join(root, area)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter(
      (f) =>
        extensions.some((e) => f.endsWith(e)) &&
        !f.endsWith('.test.mjs') &&
        !f.endsWith('.test.ts') &&
        !f.endsWith('.d.ts')
    )
    .map((f) => path.join(area, f))
    .sort()
}

/**
 * Runs a test glob in a workspace; true when it passes.
 *
 * The timeout matters more than it looks. Inverting a loop bound is one of
 * the mutations here, and some of those mutants do not fail — they hang. With
 * a flat three-minute limit a single hanging mutant cost more wall clock than
 * the other two hundred put together, which is how a probe over a
 * one-second suite ends up taking an hour. A hang IS a killed mutant: the
 * suite did not pass.
 *
 * It kills the process GROUP, not the child, and that distinction was a real
 * leak. The hang is usually inside a script the SUITE spawned rather than in
 * the suite itself: a test that verifies a CLI runs it. `execFileSync` can only
 * signal its direct child, so those grandchildren were reparented to PID 1 and
 * kept spinning. Measured on 2026-09-13: thirteen of them, one to four and a
 * half hours old, consuming 534% of CPU in shell compare loops and 590% in
 * `source-reachability`. The probe reported every one of those mutants as killed
 * — correctly — while the machine stayed saturated, and each later mutant
 * competed for CPU with a zombie of an earlier one.
 *
 * `detached: true` gives the child its own process group, so `-pid` reaches
 * every descendant and never the process that called us.
 *
 * The kill happens on BOTH paths, and that second half was another leak. Killing
 * only on the timeout misses the case where the child exits ON ITS OWN while
 * something it spawned keeps running: a suite that launches a script and
 * finishes leaves that script reparented to PID 1. Measured on 2026-09-13 with a
 * three-process reproducer: on the timeout path zero survivors, on the exit path
 * one. Killing the group on every completion closes both, and it is safe on the
 * exit path precisely because the direct child is already gone — whatever the
 * group still holds is a descendant to reap. A group that no longer exists
 * throws ESRCH, which is ignored.
 *
 * Exported so its contract can be tested directly: a defect here corrupts every
 * number the probe reports, which is the same reason `mutationsFor` is exported.
 */
export function suitePasses(cwd, glob, timeout = 180000, runner = null) {
  const [command, args, opts] = runner
    ? [runner.command, runner.args, { cwd: path.join(cwd, runner.cwd ?? '.') }]
    : // La concurrencia se limita a 2. El default de `node --test` es
      // `availableParallelism() - 1`, que en esta máquina son 11, y con un
      // mutante que asigna de más el pico de memoria de la corrida es el de
      // once procesos sumados. Medido: el conjunto de `node --test` pico en
      // 322 MB con el default, sobre una máquina que ya venía al 91% de uso.
      // Con 2 el pico baja y, de paso, el veredicto de cada mutante se mide
      // sin competir por CPU con los otros diez.
      ['node', ['--test', '--test-concurrency=2', ...expand(cwd, glob)], { cwd }]

  // El padre puede ser a su vez un proceso de `node --test`, que inyecta
  // NODE_TEST_CONTEXT y convierte al hijo en un reportero de máquina: no corre
  // ningún test y sale 0. Una suite vacía se reporta verde y el mutante que
  // debía morir sobrevive. `real-corpus.mjs` ya se defendía de esto; la sonda no.
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  delete env.NODE_TEST_WORKER_ID

  // Techo de heap, heredado por los nietos vía NODE_OPTIONS porque `node --test`
  // corre cada archivo en su propio proceso.
  //
  // Un mutante no necesita el heap entero para responder si el código sigue
  // haciendo lo que dice. El default de V8 en una máquina de 16 GB ronda los
  // 4 GB, y un mutante que gira sin freno los pide todos antes de abortar.
  // Medido el 2026-09-13: veintiún abortos por `FatalProcessOutOfMemory` en un
  // día con el default, y la presión que generan es lo que hace que el sistema
  // operativo empiece a terminar procesos que no tienen nada que ver.
  //
  // El techo no cambia el veredicto —un mutante que no termina ya cuenta como
  // muerto por el timeout— y convierte una asignación que amenaza a la máquina
  // en un fallo contenido. Va acompañado de `assertEnoughMemory()`: el techo
  // acota a UN proceso, la precondición cuida a la máquina.
  env.NODE_OPTIONS = [env.NODE_OPTIONS, `--max-old-space-size=${MUTANT_HEAP_MB}`]
    .filter(Boolean)
    .join(' ')

  return new Promise((resolve) => {
    const child = spawn(command, args, { ...opts, env, stdio: 'ignore', detached: true })

    // Registrada mientras vive: en memoria para el camino normal, y en disco
    // para el caso en que maten a este proceso y la suite quede huérfana.
    LIVE_SUITES.add(child.pid)
    recordSuite(child.pid)

    const killGroup = () => {
      LIVE_SUITES.delete(child.pid)
      recordSuite(child.pid, true)
      try {
        process.kill(-child.pid, 'SIGKILL')
      } catch {
        // El grupo ya no existe: nada que recoger.
      }
    }

    let settled = false
    const finish = (passed) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      killGroup()
      resolve(passed)
    }
    const timer = setTimeout(() => finish(false), timeout)
    child.on('exit', (code) => finish(code === 0))
    child.on('error', () => finish(false))
  })
}

/**
 * Makes the copy runnable for a suite that needs generated or installed state.
 *
 * `node --test` over AOI's own scripts needs nothing, but the dashboard runs
 * under vitest. Copying node_modules would cost more than the measurement;
 * linking it is free and the run only reads from it. `.nuxt` is linked for
 * the same reason and is not optional: `tsconfig.json` extends
 * `./.nuxt/tsconfig.json`, so without it every test file fails to resolve
 * before a single assertion runs — the copy reports 23 failed suites and
 * zero tests, which looks like a broken product rather than a missing link.
 */
const LINKED_STATE = ['node_modules', '.nuxt']

function linkDependencies(root, work, relativeDirs) {
  for (const rel of relativeDirs) {
    for (const name of LINKED_STATE) {
      const source = path.join(root, rel, name)
      if (!fs.existsSync(source)) continue
      const target = path.join(work, rel, name)
      if (fs.existsSync(target)) continue
      fs.mkdirSync(path.dirname(target), { recursive: true })
      try {
        fs.symlinkSync(source, target, 'dir')
      } catch {
        // A copy without them simply fails its baseline, loudly.
      }
    }
  }
}

/** How long to allow a mutated run, from how long the clean one took. */
export function mutantTimeout(baselineMs) {
  return Math.min(120000, Math.max(15000, baselineMs * 10))
}

/**
 * Techo de heap (MB) para los procesos que corre un mutante.
 *
 * Ver el comentario en `suitePasses`. El valor sale del uso real medido de las
 * suites de este repositorio —la suma de todos los procesos de `node --test`
 * en una corrida normal pico en 322 MB, así que uno solo queda muy por
 * debajo— con margen para varias veces eso.
 *
 * El margen importa en las DOS direcciones y la peligrosa es la de abajo: un
 * techo demasiado bajo hace que un mutante legítimo muera por falta de memoria
 * en vez de por un test que falla, y eso se cuenta como mutante muerto e infla
 * el score. Ante la duda, el techo sube.
 */
export const MUTANT_HEAP_MB = 512

/**
 * Memoria reclamable mínima (MB) para que el probe arranque.
 *
 * Es una guarda de segundo orden, y conviene decir por qué, porque medir el
 * problema real desmintió la primera explicación. La máquina del Owner reportó
 * "se cerraron todas las aplicaciones" durante corridas del probe, y el primer
 * diagnóstico fue presión de memoria. Al medir: la memoria reclamable era de
 * siete GB, así que no era eso. Lo que apareció en el log del sistema fue una
 * tormenta de `mdworker` —los indexadores de Spotlight— muriendo por SIGKILL.
 *
 * La causa es AMPLIFICACIÓN DE I/O Y DE PROCESOS, que es una propiedad de este
 * instrumento y no de la máquina:
 *
 *   - `gate-exit-codes.test.mjs` copia el árbol de fuentes a un temporal en su
 *     `before()`, y ese archivo corre en CADA mutante. Medido: 978 archivos y
 *     unos 23 MB por copia, o sea unos 161.000 archivos creados y borrados por
 *     corrida.
 *   - Cada uno de esos casos corre compuertas con `execFileSync`, unas diecisiete
 *     invocaciones de `node` por mutante: unos 2.800 procesos por corrida.
 *   - Todo eso vive en el temporal, así que Spotlight intenta indexarlo y el
 *     sistema gasta CPU e I/O en indexar archivos que existen para borrarse.
 *
 * La memoria sigue valiendo como guarda —un mutante que asigna sin freno pide
 * su techo entero— pero NO es la causa principal, y dejarlo escrito como si lo
 * fuera sería el mismo error que este repositorio ya tiene documentado: confundir
 * el síntoma medido con el mecanismo.
 *
 * Leer esto antes de correr el probe en una máquina de trabajo.
 */
export const MIN_FREE_MB = 2048

/**
 * Memoria reclamable en MB a partir de la salida cruda de `vm_stat`.
 *
 * Es una función PURA y separada de la ejecución por la misma razón que
 * `assertEnoughMemory` recibe su sonda: la decisión se puede fijar con casos
 * directos, el efecto no. Medido: con la lectura y el parseo en la misma
 * función, sus tres mutantes —los dos `||` de los fallbacks y el `> 0`— no
 * tenían ninguna entrada de test que los distinguiera, porque `vm_stat` siempre
 * contesta bien en macOS y el camino de fallback nunca se recorre. Extraer el
 * parseo permite darle la salida que el fallback existe para manejar.
 *
 * En macOS `Pages free` solo no sirve: el sistema usa la RAM libre como caché a
 * propósito y reporta muy poco "libre" en una máquina sana. Lo que importa es
 * lo reclamable —libre, inactiva y especulativa— que es el número que Activity
 * Monitor muestra cerca de "disponible".
 *
 * @param {string} out salida de `vm_stat`
 * @param {number} tamanoPaginaPorDefecto se usa si la salida no declara el tamaño
 * @returns {number} MB reclamables, 0 si la salida no trae los contadores
 */
export function parseVmStat(out, tamanoPaginaPorDefecto = 4096) {
  const declared = /page size of (\d+)/.exec(out)
  const pageSize = declared ? Number(declared[1]) : tamanoPaginaPorDefecto
  const pages = (label) => {
    const m = new RegExp(`${label}:\\s+(\\d+)`).exec(out)
    return m ? Number(m[1]) : 0
  }
  const reclaimable =
    pages('Pages free') + pages('Pages inactive') + pages('Pages speculative')
  return Math.round((reclaimable * pageSize) / 1048576)
}

/**
 * Memoria que el sistema puede reclamar ahora, en MB.
 *
 * Las DOS entradas se inyectan, y la segunda no es decorativa. `vm_stat` es de
 * macOS: en Linux no existe, `execFileSync` lanza, y la respuesta sale de
 * `os.freemem()`. Si el fallback no se puede inyectar, el test que lo fija
 * tiene que comparar contra una lectura de `os.freemem()` hecha por su cuenta —
 * o sea contra OTRA lectura de una metrica viva. En macOS `os.freemem()` esta
 * cacheado y las dos coinciden; en Linux lee en cada llamada y la asercion es
 * flaky. Medido el 2026-09-13: `pnpm test` pasaba local y el trinquete fallaba
 * en CI, sin forma de ver que test habia roto.
 *
 * @param {() => string} run inyectable: la sonda del sistema
 * @param {() => number} fallback inyectable: de donde sale el numero cuando la
 *   sonda no sirve. Devolver el valor y no leerlo adentro es lo que hace que el
 *   contrato se pueda fijar con un caso determinista.
 */
export function availableMemoryMB(
  run = () => execFileSync('vm_stat', { encoding: 'utf8' }),
  fallback = () => Math.round(os.freemem() / 1048576)
) {
  try {
    const mb = parseVmStat(run())
    // La unica decision de esta funcion, y por eso `> 0` y no `>= 0`: un cero
    // aca significa que la salida no traia los contadores, asi que hay que caer
    // al fallback. Tratarlo como una medicion valida haria que la precondicion
    // corte siempre.
    if (mb > 0) return mb
  } catch {
    // No es macOS, o `vm_stat` no esta: se cae al fallback.
  }
  return fallback()
}

/**
 * Corta si la máquina no tiene memoria para sostener la corrida.
 *
 * Guarda de segundo orden: la causa principal del daño al entorno es la
 * amplificación de I/O y de procesos (ver `MIN_FREE_MB`), no la memoria. Esta
 * corta el caso en que ni siquiera hay lugar para un proceso más.
 *
 * @param {number} minMB umbral
 * @param {() => number} probeFn inyectable para poder fijar el contrato
 */
export function assertEnoughMemory(minMB = MIN_FREE_MB, probeFn = availableMemoryMB) {
  const have = probeFn()
  if (have < minMB) {
    throw new Error(
      `Memoria reclamable insuficiente para correr el probe: ${have} MB, mínimo ${minMB} MB.\n` +
        `El probe planta un mutante por vez sobre una copia y algunos mutantes asignan sin freno.\n` +
        `Con la máquina justa de memoria eso termina en presión de memoria y el sistema empieza a\n` +
        `terminar procesos ajenos al probe. Cerrá lo que no necesites y volvé a intentar.`
    )
  }
  return have
}

/**
 * Los pids de las suites que ESTE proceso lanzó y todavía no cerró.
 *
 * Es un registro y no una inferencia, y la diferencia es la que cierra la fuga.
 * `reapGhosts` matcheaba por la línea de `ps`, y el proceso que de verdad había
 * que recoger —el `node --test suite.test.mjs`— **no lleva ninguna marca en sus
 * argumentos**: la marca está en su directorio de trabajo, y `ps -Ao args` no
 * muestra el cwd. Medido el 2026-09-13: un huérfano de 49 minutos con `cwd` en
 * `aoi-probe-ghost-7IuozJ` y la línea `node --test-concurrency=2 suite.test.mjs`,
 * que ningún patrón de `args` podía atrapar.
 *
 * Tampoco alcanza con matar al padre del fantasma: la jerarquía real es
 * `node --test` (detached, propio grupo) -> runner por archivo -> fantasma, y el
 * abuelo queda sin marca y vivo.
 *
 * Registrar el pid en el momento en que se lanza es exacto: no hay que adivinar
 * cuál es, ya se sabe.
 */
const LIVE_SUITES = new Set()

/**
 * El archivo donde se anotan los pids de las suites vivas.
 *
 * El registro en memoria no sobrevive a que maten al probe. Y esa es
 * exactamente la forma en que se produce la fuga: medido el 2026-09-13, el
 * operador corre `pkill -9 -f mutation-probe` —o el probe se cae por OOM— y sus
 * suites, lanzadas con `detached: true`, sobreviven al padre porque nadie llega
 * a matar su grupo. Un huérfano de 49 minutos, con su fantasma como hijo.
 *
 * El archivo no se limpia solo si el proceso muere de golpe, así que se guarda
 * el pid DEL PROBE junto al de la suite: una corrida posterior sólo recoge las
 * suites cuyo probe ya no existe. Un proceso vivo no se mata por estar anotado
 * por otro.
 *
 * El nombre lleva el pid del dueño para que dos corridas en paralelo no
 * compartan archivo.
 */
export function suitesPidFile(ownerPid = process.pid) {
  return path.join(os.tmpdir(), `aoi-probe-suites.${ownerPid}`)
}

/** Anota (o quita) una suite del archivo. Los errores no interrumpen la medición. */
function recordSuite(pid, quitar = false) {
  const file = suitesPidFile()
  try {
    const previos = fs.existsSync(file)
      ? fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim() !== '')
      : []
    const siguientes = quitar
      ? previos.filter((l) => Number(l) !== pid)
      : [...new Set([...previos, String(pid)])]
    // Si no queda ninguna suite viva, el archivo se BORRA en vez de quedar
    // vacío: un archivo vacío por corrida se acumula en el temporal y no aporta
    // nada —no hay nada que recoger—, mientras que su ausencia es informativa.
    if (siguientes.length === 0) {
      fs.rmSync(file, { force: true })
      return
    }
    fs.writeFileSync(file, siguientes.join('\n') + '\n')
  } catch {
    // El pidfile es una red de seguridad, no un requisito para medir.
  }
}

/**
 * Si el pid es de verdad una suite del probe, mirando su línea de `ps`.
 *
 * Esta verificación es OBLIGATORIA antes de matar, y no es una precaución
 * teórica: **los pids se reciclan**. `reapStaleSuites` lee pids de un archivo
 * escrito por una corrida anterior, y entre aquella corrida y ésta el sistema
 * pudo reasignar ese número a cualquier proceso. Matar por grupo un pid
 * reciclado puede llevarse un grupo de procesos ajeno.
 *
 * Medido el 2026-09-14: el CI pasó de rojo a `failure` con el ratchet en
 * `in_progress`, sin ningún paso marcado como fallido y con los logs vacíos —
 * la firma de un runner que murió, no de una compuerta que falló. Y en el
 * camino del ratchet, el test de este módulo corre cientos de veces, cada una
 * fabricando pids muertos y llamando a `reapStaleSuites`. Es exactamente el
 * escenario donde el reciclado ocurre.
 *
 * La identificación por argumentos es la que acota el daño: un pid reciclado
 * tendría que estar corriendo además un `suite.test.mjs` para pasar el filtro.
 */
function looksLikeOurSuite(pid) {
  try {
    const out = execFileSync('ps', ['-o', 'args=', '-p', String(pid)], { encoding: 'utf8' })
    return /suite\.test\.mjs/.test(out)
  } catch {
    // El proceso no existe, o `ps` no está: en los dos casos no se mata.
    return false
  }
}

/**
 * Recoge las suites que quedaron de corridas ANTERIORES ya muertas.
 *
 * Lee los pidfiles de este directorio temporal, y para cada uno comprueba si su
 * probe dueño sigue vivo. Sólo si ya no está, y **sólo si el pid se identifica
 * como una suite del probe**, mata el grupo: un proceso vivo no se toca por
 * estar anotado por otro, y un pid reciclado no se toca porque no pasa la
 * verificación de argumentos.
 *
 * @returns {number} cuántos grupos se terminaron
 */
export function reapStaleSuites() {
  let reaped = 0
  let archivos = []
  try {
    archivos = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('aoi-probe-suites.'))
  } catch {
    return 0
  }
  for (const nombre of archivos) {
    const dueno = Number(nombre.slice('aoi-probe-suites.'.length))
    if (!Number.isInteger(dueno) || dueno === process.pid) continue
    let vivo = true
    try {
      process.kill(dueno, 0)
    } catch {
      vivo = false
    }
    if (vivo) continue
    const file = path.join(os.tmpdir(), nombre)
    let pids = []
    try {
      pids = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim() !== '').map(Number)
    } catch {
      pids = []
    }
    for (const pid of pids) {
      if (!Number.isInteger(pid) || pid <= 1) continue
      // La verificación que evita matar un pid reciclado. Sin esto, el archivo
      // es una lista de números que envejeció, y matar por él es una apuesta.
      if (!looksLikeOurSuite(pid)) continue
      try {
        process.kill(-pid, 'SIGKILL')
        reaped += 1
      } catch {
        try {
          process.kill(pid, 'SIGKILL')
          reaped += 1
        } catch {
          // Ya no existe.
        }
      }
    }
    try {
      fs.rmSync(file, { force: true })
    } catch {
      // Si no se puede borrar, la próxima corrida lo reintenta.
    }
  }
  return reaped
}

/** Sólo para los tests: cuántas suites cree tener vivas este módulo. */
export function liveSuiteCount() {
  return LIVE_SUITES.size
}

/** La marca que el fixture de `mutation-probe.test.mjs` le pone a su fantasma. */
export const GHOST_MARK = 'aoi-probe-ghost-'

/**
 * La marca del DIRECTORIO donde el fixture del test deja su suite y su fantasma.
 *
 * Es distinta de `GHOST_MARK` a propósito y las dos hacen falta: el fantasma es
 * el proceso `ghost-*.mjs`, y el contaminante de verdad es el `suite.test.mjs`
 * que lo lanza — el que sobrevive y gira. Medido el 2026-09-13: un
 * `suite.test.mjs` huérfano con 49 minutos de vida, cwd en
 * `aoi-probe-ghost-7IuozJ`, con el fantasma como hijo.
 *
 * `reapGhosts` mataba SÓLO el fantasma, porque su marca coincide con la del
 * archivo. Esto es el directorio que contiene a los dos.
 */
export const GHOST_DIR_MARK = 'aoi-probe-ghost-'

/** Nada que recoger. Un centinela numérico, no un booleano: ver `ghostPidToReap`. */
export const NO_PID = -1

/**
 * El pid que esta línea autoriza a terminar, o -1 si ninguno.
 *
 * DEVUELVE UN PID Y NO UN BOOLEANO, y esa elección es la diferencia entre un
 * reaper y una catástrofe. El probe se mide a sí mismo —`mutation-probe.mjs`
 * vive dentro del área que mide— así que su propio código recibe mutantes, y el
 * conjunto de operadores incluye `true→false` y `false→true`, que reescriben el
 * literal booleano, más `&&→||`, que convierte una conjunción en una disyunción.
 *
 * Medido el 2026-09-13: con la versión booleana —`if (!marca) return false`, con
 * la validación de pid en un `&&`— el mutante `false→true` sobre el
 * `return false` hace que el predicado matchee **492 de 492 líneas** de
 * `ps -Ao pid,args`, incluido `pid 1 /sbin/launchd`. Y `and→or` sobre la
 * validación tiene el mismo efecto por el otro lado: desactiva la exigencia de
 * la marca. Cualquiera de los dos convierte `reapGhosts` en un asesino que
 * recorre la tabla de procesos y le manda SIGKILL a cada uno. Eso es lo que
 * cerraba las aplicaciones del Owner: no era el sistema operativo con presión
 * de memoria, era este mutante matando vecinos.
 *
 * Un número no tiene literal que invertir. Las mutaciones que quedan solo pueden
 * volver al predicado MÁS restrictivo —`idx < 0` a `idx <= 0`, que el caso de
 * test que exige recoger un fantasma real detecta— o dejar pasar líneas que
 * IGUAL llevan la marca, que son las que este módulo creó.
 *
 * @param {string} line una línea de `ps -Ao pid,args`
 * @param {string[]} marks marcas que este llamador tiene permitido recoger
 * @param {number} selfPid el pid del proceso que llama, para no recogerse solo
 */
export function ghostPidToReap(line, marks, selfPid = process.pid) {
  const idx = ghostMarkIndex(line, marks)
  if (idx < 0) return NO_PID
  const pid = Number(line.trim().split(/\s+/)[0])
  if (!Number.isInteger(pid) || pid <= 1 || pid === selfPid) return NO_PID
  return pid
}

/**
 * El índice de la primera marca que la línea lleva, o -1.
 *
 * Está escrito con una guarda `continue` por condición y NO con una conjunción,
 * y esa forma es el punto. Verificado con un script que genera los diez
 * mutantes de este par de funciones y evalúa cada uno contra la salida real de
 * `ps` sin mandar una señal: con la versión `&&` —`typeof m === 'string' &&
 * m.length > 0 && line.includes(m)`— el mutante `and→or` hace que la primera
 * condición sea verdadera para cualquier marca y que `findIndex` devuelva 0 en
 * TODAS las líneas. El guardián se volvía incondicional y autorizaba 483 de 486
 * procesos. Con `continue`, cada mutación posible o bien es más restrictiva
 * —y el caso de test que exige recoger un fantasma real la mata— o bien lanza
 * excepción, que también mata al mutante. Ninguna puede autorizar de más. *
 * UN EQUIVALENTE MEDIDO, no pasado por alto: `i < marks.length` mutado a
 * `i <= marks.length` sobrevive. Se verificó por qué en vez de suponerlo: la
 * vuelta de más lee `marks[length]`, que es `undefined`, y la guarda de tipo lo
 * descarta con el mismo `continue`. Ejecutado sobre diez entradas —incluidos
 * marca vacía, arreglo vacío, varias marcas y pid no numérico— el original y el
 * mutante coinciden en las diez. No hay entrada que los distinga, así que se
 * documenta en vez de perseguirlo, que es la regla para esta clase. */
function ghostMarkIndex(line, marks) {
  if (!Array.isArray(marks)) return NO_PID
  if (marks.length === 0) return NO_PID
  for (let i = 0; i < marks.length; i++) {
    const m = marks[i]
    if (typeof m !== 'string') continue
    if (m.length === 0) continue
    if (line.includes(m)) return i
  }
  return NO_PID
}

/**
 * Recoge los fantasmas que una corrida mutada haya dejado atrás.
 *
 * El fixture de la suite lanza un proceso que tiene que seguir vivo para que
 * el caso pruebe que la limpieza lo mata. Cuando el probe corta la suite mutada
 * por timeout —que es exactamente lo que hace cuando el mutante rompe la ruta
 * de limpieza— el `finally` del test no llega a correr, y el fantasma queda
 * suelto. Es inherente a medir esa ruta: el código que lo recoge es el que se
 * está mutando.
 *
 * El daño ya no es CPU —el fixture mantiene al fantasma con un intervalo
 * inactivo y no con un bucle ocupado— pero un proceso por mutante que se
 * acumule sigue siendo un problema, así que se recogen desde afuera del código
 * mutado.
 *
 * @param {string[]} marks marcas a recoger. **Vacío significa no matar nada**,
 *   que es la dirección segura: un llamador que se olvide del argumento deja
 *   fantasmas vivos, y eso se nota; al revés mataría procesos ajenos en
 *   silencio.
 * @returns {number} cuántos procesos se terminaron
 *
 * UN EQUIVALENTE MEDIDO: `pid < 0` mutado a `pid <= 0` sobrevive, y está bien
 * que sobreviva. `ghostPidToReap` devuelve `-1` o un pid mayor que 1 —el cero
 * es inalcanzable por su propia guarda— así que las dos formas son la misma
 * función. Verificado sobre diez entradas, coinciden en las diez.
 */
export function reapGhosts(marks = [GHOST_MARK, GHOST_DIR_MARK]) {
  let reaped = 0

  // Primero las suites que ESTE módulo lanzó y no cerró: es la parte exacta, y
  // la que atrapa al proceso que ninguna marca de `args` alcanza.
  for (const pid of [...LIVE_SUITES]) {
    try {
      process.kill(-pid, 'SIGKILL')
      reaped += 1
    } catch {
      try {
        process.kill(pid, 'SIGKILL')
        reaped += 1
      } catch {
        // Ya no existe.
      }
    }
    LIVE_SUITES.delete(pid)
  }

  let out = ''
  try {
    // `ppid` y no sólo `pid,args`: el padre del fantasma es el runner, y esa
    // línea tampoco lleva la marca.
    out = execFileSync('ps', ['-Ao', 'pid,ppid,args'], { encoding: 'utf8' })
  } catch {
    return reaped
  }
  const padres = new Set()
  for (const line of out.split('\n')) {
    const pid = ghostPidToReap(line, marks, process.pid)
    if (pid < 0) continue

    // El padre del fantasma es el runner que lo lanzó. Su línea de `ps` es
    // `node --test-concurrency=2 suite.test.mjs`, sin ninguna marca. Se mata
    // SÓLO si es el padre de un fantasma: nunca se elige un proceso por su
    // nombre, que es la lección del reaper booleano.
    const campos = line.trim().split(/\s+/)
    const ppid = Number(campos[1])
    if (Number.isInteger(ppid) && ppid > 1 && ppid !== process.pid) padres.add(ppid)

    try {
      process.kill(-pid, 'SIGKILL')
      reaped += 1
    } catch {
      try {
        process.kill(pid, 'SIGKILL')
        reaped += 1
      } catch {
        // Ya no existe: nada que recoger.
      }
    }
  }

  for (const ppid of padres) {
    try {
      process.kill(-ppid, 'SIGKILL')
      reaped += 1
    } catch {
      try {
        process.kill(ppid, 'SIGKILL')
        reaped += 1
      } catch {
        // Ya no existe.
      }
    }
  }
  return reaped
}

function expand(cwd, glob) {
  const dir = path.dirname(glob)
  const base = path.basename(glob).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  const re = new RegExp(`^${base}$`)
  return fs
    .readdirSync(path.join(cwd, dir))
    .filter((f) => re.test(f))
    .map((f) => path.join(dir, f))
    .sort()
}

/**
 * La salida de una suite que falla, para poder diagnosticarla.
 *
 * `suitePasses` corre sus hijos con `stdio: 'ignore'`, y eso es correcto para el
 * ciclo de mutantes: capturar todas las corridas costaria la memoria que el
 * techo de heap existe para acotar. Pero deja CI sin diagnostico. Cuando un area
 * falla antes de mutar, el unico mensaje es "la suite ya falla sin mutar", y no
 * hay forma de saber QUE test fallo sin reproducir en la misma maquina — que es
 * exactamente el problema cuando la falla depende del entorno.
 *
 * Medido el 2026-09-13: un commit paso `pnpm test` en macOS y rompio el
 * trinquete en Linux, y el log de CI no alcanzaba para distinguir cual de los
 * diez archivos del area habia fallado.
 *
 * Se llama SOLO cuando el baseline falla: una corrida extra en el camino de
 * error, cero costo en el normal.
 */
export function suiteFailureTail(cwd, glob, timeout = 180000, runner = null, maxChars = 4000) {
  const [command, args, opts] = runner
    ? [runner.command, runner.args, { cwd: path.join(cwd, runner.cwd ?? '.') }]
    : // `--test-reporter=tap` no es cosmético: sin él el hijo elige el reportero
      // por su entorno, y un `node --test` anidado dentro de otro usa el de spec
      // (`ℹ tests 1`) en vez de TAP (`# tests 1`). Medido el 2026-09-13: los
      // casos de esta función pasaban sueltos y fallaban bajo `pnpm test`, por
      // la única diferencia de estar anidados. Fijar el formato es lo que hace
      // que la salida no dependa de quién llamó.
      ['node', ['--test', '--test-concurrency=2', '--test-reporter=tap', ...expand(cwd, glob)], { cwd }]

  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  delete env.NODE_TEST_WORKER_ID
  env.NODE_OPTIONS = [env.NODE_OPTIONS, `--max-old-space-size=${MUTANT_HEAP_MB}`]
    .filter(Boolean)
    .join(' ')

  try {
    const r = spawnSync(command, args, { ...opts, env, encoding: 'utf8', timeout })
    if (r.error && r.error.code === 'ETIMEDOUT') return `(la suite no termino en ${timeout} ms)`
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim()
    if (!out) return `(la suite no imprimio nada; exit ${r.status})`

    // Se conservan el PRINCIPIO y el FINAL, y no se filtra ninguna linea.
    //
    // Las dos decisiones salieron de casos que fallaron al escribirlas. Un
    // recorte ciego por el final se lleva la falla, porque `node:test` imprime
    // cada falla cerca del principio y el resumen al final. Y un filtro por
    // lineas que "parecen" fallas rompe los bloques YAML: el mensaje de la
    // asercion vive DENTRO de `error: |-`, en la linea siguiente, y no coincide
    // con ningun patron. Medido: el filtro dejaba `error: |-` huerfano y perdia
    // el mensaje, que es lo unico que se queria leer.
    //
    // La proporcion 60/40 sale de medir la estructura de una salida real: con
    // una falla, el mensaje de la asercion cae alrededor del 40% de la salida y
    // el resumen en el ultimo 15%. Darle mas a la cabeza es lo que deja el
    // mensaje adentro; darle el resto a la cola conserva los totales.
    if (out.length <= maxChars) return out
    const cabeza = Math.floor(maxChars * 0.6)
    const cola = maxChars - cabeza
    return `${out.slice(0, cabeza)}\n…(recortado ${out.length - maxChars} caracteres)…\n${out.slice(-cola)}`
  } catch (e) {
    return `(no se pudo capturar la salida: ${e.message})`
  }
}

/**
 * Borra una copia de trabajo y todo lo que colgaba de ella.
 *
 * Separado porque hay TRES caminos que tienen que llamarlo —la salida normal,
 * una excepción y una señal— y la versión anterior lo tenía escrito una sola
 * vez, al final del camino feliz. Medido el 2026-09-16: seis directorios
 * `aoi-mutate-*` de 8 MB cada uno en el temporal, cinco de ellos de corridas
 * que el operador había interrumpido a mano. El costo no es el disco: es que
 * una copia entera del árbol sobrevive a la medición que la creó.
 */
function releaseWork(work) {
  reapGhosts()
  try {
    fs.rmSync(work, { recursive: true, force: true })
  } catch {
    // Si no se puede borrar ahora, `sweepOrphanCopies` lo recoge en la próxima
    // corrida: el nombre lleva el pid del dueño justamente para eso.
  }
}

/**
 * La copia que deja una corrida que murió sin poder limpiar.
 *
 * `releaseWork` cubre la salida normal, la excepción y la señal. No cubre
 * `SIGKILL` —que no se puede atrapar— ni un cierre por OOM, y ésos son
 * exactamente los casos que este repo ya midió. El nombre de la copia lleva el
 * pid del dueño, así que una corrida posterior distingue "huérfana" de "en
 * uso" sin adivinar por fecha.
 *
 * Sólo borra lo que pertenece a un pid que ya no existe: un proceso vivo no ve
 * su copia borrada por otro.
 *
 * @returns {number} cuántas copias se borraron
 */
export function sweepOrphanCopies() {
  let removed = 0
  let entradas = []
  try {
    entradas = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith(WORK_PREFIX))
  } catch {
    return 0
  }
  for (const nombre of entradas) {
    const dueno = Number(nombre.slice(WORK_PREFIX.length).split('-')[0])
    if (!Number.isInteger(dueno) || dueno <= 1 || dueno === process.pid) continue
    try {
      // Señal 0: no mata, sólo pregunta si existe.
      process.kill(dueno, 0)
      continue
    } catch {
      // El dueño ya no está: su copia quedó a medio camino.
    }
    try {
      fs.rmSync(path.join(os.tmpdir(), nombre), { recursive: true, force: true })
      removed += 1
    } catch {
      // Si no se puede borrar, la próxima corrida lo reintenta.
    }
  }
  return removed
}

/**
 * Limpia también cuando la corrida se corta desde afuera.
 *
 * Sin esto, el `finally` no alcanza: un `SIGINT`/`SIGTERM` termina el proceso
 * sin desenrollar la pila, así que la copia y las suites quedaban vivas. Es el
 * camino que el operador usa de verdad — un probe de una hora se interrumpe a
 * mano mucho antes de que termine.
 *
 * @returns {() => void} desregistra los handlers
 */
function installSignalCleanup(work) {
  const onSignal = (signal) => {
    releaseWork(work)
    process.exit(signal === 'SIGINT' ? 130 : 143)
  }
  process.once('SIGINT', onSignal)
  process.once('SIGTERM', onSignal)
  return () => {
    process.removeListener('SIGINT', onSignal)
    process.removeListener('SIGTERM', onSignal)
  }
}

export async function probe(root, area, testGlob, limit = Infinity, log = () => {}, runner = null, extensions = DEFAULT_EXTENSIONS) {
  // El pid en el nombre es lo que permite que una corrida posterior reconozca
  // esta copia como huérfana si el proceso muere sin poder limpiar.
  const work = fs.mkdtempSync(path.join(os.tmpdir(), `${WORK_PREFIX}${process.pid}-`))
  // The mirror travels with the copy. Excluding it was a size optimisation
  // and it broke a real test: `scripts/conf` asserts that the files the
  // installer materialises are the ones the scaffold ships, so without the
  // mirror that area's suite failed before a single mutant was planted — and
  // a probe that cannot get a clean baseline reports nothing at all.
  //
  // The trade-off to remember: an area whose tests compare a file against its
  // mirror byte for byte would kill every mutant spuriously, because only the
  // original gets mutated. No measured area does that today.
  const EXCLUDED = /(?:^|\/)(?:node_modules|\.git|\.nuxt|\.output|coverage)(?:\/|$)/
  fs.cpSync(root, work, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(root, src)
      return rel === '' || !EXCLUDED.test(rel)
    },
  })

  // Todo lo que sigue corre con la limpieza ya armada: la copia existe desde el
  // `mkdtempSync` de arriba, así que cualquier fallo a partir de acá tiene que
  // deshacerse de ella.
  const cleanupSignals = installSignalCleanup(work)
  try {
    if (runner) linkDependencies(root, work, ['.', runner.cwd ?? '.'])

    // Antes de plantar nada: si la máquina no tiene memoria para sostener esto,
    // se corta acá y no a mitad de camino con el sistema reaccionando.
    assertEnoughMemory()

    // Y lo que dejó una corrida anterior que murió sin limpiar: sus suites
    // seguirían girando sin dueño —una llevaba 49 minutos— y su copia de 8 MB
    // seguiría ocupando el temporal.
    reapStaleSuites()
    sweepOrphanCopies()

    const startedAt = Date.now()
    const baseline = await suitePasses(work, testGlob, 180000, runner)
    const timeout = mutantTimeout(Date.now() - startedAt)
    if (!baseline) {
      // La salida se captura ANTES de que el `finally` borre la copia.
      const tail = suiteFailureTail(work, testGlob, 180000, runner)
      throw new Error(
        `La suite de ${area} ya falla sin mutar; no se puede medir nada sobre eso.\n\n` +
          `--- salida de la suite ---\n${tail}\n--- fin ---`
      )
    }

    const survivors = []
    let killed = 0
    let total = 0

    for (const rel of areaSources(root, area, extensions)) {
      const target = path.join(work, rel)
      const original = fs.readFileSync(target, 'utf8')
      const candidates = mutationsFor(original, operatorsFor(rel))
      for (const mutation of candidates) {
        if (total >= limit) break
        total += 1
        fs.writeFileSync(target, mutation.mutated)
        if (await suitePasses(work, testGlob, timeout, runner)) {
          survivors.push({ file: rel, ...mutation, mutated: undefined })
        } else {
          killed += 1
        }
        fs.writeFileSync(target, original)
        // Fuera del código mutado, y después de que el caso ya midió: un fantasma
        // que sobrevivió a su suite no tiene por qué esperar al final del área.
        reapGhosts()
        if (total % 25 === 0) log(`  ${total} mutantes · ${killed} muertos · ${survivors.length} sobreviven`)
      }
      if (total >= limit) break
    }

    return { area, total, killed, survivors }
  } finally {
    // `releaseWork` vuelve a recoger los fantasmas, y esa segunda pasada no es
    // redundante: el recorte del bucle cubre todos los mutantes menos el último,
    // y una salida por excepción no pasó por ningún recorte.
    cleanupSignals()
    releaseWork(work)
  }
}

async function main() {
  const [area, testGlob] = process.argv.slice(2)
  const limitFlag = process.argv.indexOf('--limit')
  const limit = limitFlag > -1 ? Number(process.argv[limitFlag + 1]) : Infinity
  const runnerFlag = process.argv.indexOf('--runner')
  const runner = runnerFlag > -1 ? JSON.parse(process.argv[runnerFlag + 1]) : null
  const extFlag = process.argv.indexOf('--ext')
  const extensions = extFlag > -1 ? process.argv[extFlag + 1].split(',') : DEFAULT_EXTENSIONS
  if (!area || !testGlob) {
    process.stderr.write('Uso: mutation-probe.mjs <area-dir> <test-glob> [--limit N]\n')
    process.exit(2)
  }

  const root = process.cwd()
  process.stdout.write(`=== Mutación sobre ${area} ===\n`)
  const r = await probe(root, area, testGlob, limit, (m) => process.stdout.write(m + '\n'), runner, extensions)

  const score = r.total === 0 ? 0 : Math.round((r.killed / r.total) * 100)
  process.stdout.write(`\nMutantes: ${r.total} · muertos: ${r.killed} · sobreviven: ${r.survivors.length} · score ${score}%\n`)
  for (const s of r.survivors) {
    process.stdout.write(`  SOBREVIVE  ${s.file}:${s.line}  [${s.operator}]  ${s.before.slice(0, 90)}\n`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
