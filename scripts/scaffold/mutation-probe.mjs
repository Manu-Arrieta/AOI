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

import { execFileSync, spawn } from 'node:child_process'
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
    : ['node', ['--test', ...expand(cwd, glob)], { cwd }]

  // El padre puede ser a su vez un proceso de `node --test`, que inyecta
  // NODE_TEST_CONTEXT y convierte al hijo en un reportero de máquina: no corre
  // ningún test y sale 0. Una suite vacía se reporta verde y el mutante que
  // debía morir sobrevive. `real-corpus.mjs` ya se defendía de esto; la sonda no.
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  delete env.NODE_TEST_WORKER_ID

  // Techo de heap, heredado por los nietos via NODE_OPTIONS porque `node --test`
  // corre cada archivo en su propio proceso.
  //
  // Un mutante no necesita el heap entero para responder si el codigo sigue
  // haciendo lo que dice: las suites reales de este repositorio no llegan ni a
  // 300 MB. El default de V8 en una maquina de 16 GB ronda los 4 GB, y un
  // mutante que gira sin freno los pide todos antes de abortar. Medido el
  // 2026-09-13: 21 abortos por `FatalProcessOutOfMemory` en un dia, y la presion
  // de memoria que generan es lo que hace que el sistema operativo empiece a
  // matar procesos que no tienen nada que ver con el probe.
  //
  // El techo no cambia el veredicto —un mutante que no termina ya cuenta como
  // muerto por el timeout— y convierte una asignacion que amenaza a la maquina
  // en un fallo contenido y rapido. El margen es 3x sobre el uso real medido,
  // para que no convierta un mutante legitimo en un falso muerto.
  env.NODE_OPTIONS = [env.NODE_OPTIONS, `--max-old-space-size=${MUTANT_HEAP_MB}`]
    .filter(Boolean)
    .join(' ')

  return new Promise((resolve) => {
    const child = spawn(command, args, { ...opts, env, stdio: 'ignore', detached: true })

    const killGroup = () => {
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
 * Ver el comentario en `suitePasses`. El valor sale del uso real de las suites
 * de este repositorio (<300 MB) con 3x de margen, para acotar el dano sin
 * convertir un mutante legitimo en un falso muerto.
 */
export const MUTANT_HEAP_MB = 1024

/** La marca que el fixture de `mutation-probe.test.mjs` le pone a su fantasma. */
export const GHOST_MARK = 'aoi-probe-ghost-'

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
 * excepción, que también mata al mutante. Ninguna puede autorizar de más.
 */
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
 */
export function reapGhosts(marks = [GHOST_MARK]) {
  let out = ''
  try {
    out = execFileSync('ps', ['-Ao', 'pid,args'], { encoding: 'utf8' })
  } catch {
    return 0
  }
  let reaped = 0
  for (const line of out.split('\n')) {
    const pid = ghostPidToReap(line, marks, process.pid)
    if (pid < 0) continue
    try {
      process.kill(pid, 'SIGKILL')
      reaped += 1
    } catch {
      // Ya no existe: nada que recoger.
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

export async function probe(root, area, testGlob, limit = Infinity, log = () => {}, runner = null, extensions = DEFAULT_EXTENSIONS) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-mutate-'))
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

  if (runner) linkDependencies(root, work, ['.', runner.cwd ?? '.'])

  const startedAt = Date.now()
  const baseline = await suitePasses(work, testGlob, 180000, runner)
  const timeout = mutantTimeout(Date.now() - startedAt)
  if (!baseline) {
    fs.rmSync(work, { recursive: true, force: true })
    throw new Error(`La suite de ${area} ya falla sin mutar; no se puede medir nada sobre eso.`)
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

  // El recorte dentro del bucle cubre todos los mutantes menos el último, así
  // que sin esta línea el que deja el mutante final se queda vivo. Medido: una
  // corrida completa dejaba uno suelto con el recorte sólo dentro del bucle.
  reapGhosts()
  fs.rmSync(work, { recursive: true, force: true })
  return { area, total, killed, survivors }
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
