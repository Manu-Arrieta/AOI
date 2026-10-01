#!/usr/bin/env node
/**
 * scripts/multi-harness/entry-point-probe.mjs
 *
 * ¿El script que la prosa manda correr RESPONDE cuando se lo corre?
 *
 * El defecto que esto cierra, medido dos veces (2026-09-20):
 *
 *   · `synthesize-stubs.mjs` exportaba funciones y no tenía `main`. La prosa de
 *     `/sdd-apply` lo invocaba, y `node synthesize-stubs.mjs` salía **0 sin
 *     imprimir nada**. El rastro estaba a la vista: `fileURLToPath` importado y
 *     sin usar.
 *   · `context-tombstone.mjs` por el mismo camino, hasta que se le separó el CLI.
 *
 * **Por qué ninguna de las 26 compuertas lo veía.** `aoi:lint-refs` verifica que
 * la RUTA exista; `aoi:tools` que el nombre esté en un code span —o sea que el
 * needle matchee TEXTO, no que el archivo pueda correr—; `reachability` que un
 * test lo importe, y un import no necesita CLI; `aoi:mutation` que los tests
 * maten mutantes, y un `main` ausente no es un mutante de nada. Ninguna hace la
 * pregunta: *¿el archivo que esta línea dice correr, corre?*
 *
 * **Por qué no es un regex.** La versión barata —buscar la guarda de entrada—
 * se midió y **se rechazó**: el repositorio tiene CUATRO idiomas de guarda, todos
 * válidos, y un regex naive reporta 5 falsos positivos y 0 verdaderos sobre las
 * 22 rutas. Acá la pregunta se contesta CORRIENDO el script, así que no hay
 * idioma que reconocer: hay una salida, o no la hay.
 *
 * **La firma, y su único falso positivo.** Un CLI de verdad, sin argumentos, o
 * imprime algo o falla. La tercera opción —**exit 0 con salida vacía**— es el
 * módulo que se lee como librería. La excepción son los FILTROS de stdin
 * (`diagnostic-distiller.mjs` lee `process.stdin`): sin stdin no tienen nada que
 * imprimir, y eso es correcto. Verificado: es la única de las 22.
 *
 * **Y por qué corre en una copia.** Seis de las 22 mutan el árbol al ejecutarse
 * —`compile-rules.mjs` recompila 75 archivos, `install-hooks.mjs` escribe
 * `.claude/settings.json`, `write-base-project.mjs` escribe el mapa—. Correrlas
 * "para ver qué hacen" sobre el repositorio del Owner es exactamente el efecto
 * que la compuerta no puede tener. La copia es el sandbox, y es desechable.
 *
 * **Y por qué también `package.json`, y la copia bajo una ruta con espacio.**
 * Auditoría 2026-09-30 (C1/C2): `dashboard-command.mjs` guardaba su `main` con
 * `import.meta.url === 'file://' + argv[1]`, que no coincide cuando la ruta lleva
 * un espacio —este repositorio vive bajo "GITHUB MIGRATION"—. `pnpm
 * test:dashboard` salía 0 sin imprimir nada y la cadena daba verde sin correr
 * los tests del dashboard. Esta compuerta no podía verlo por dos puntos ciegos:
 * sólo leía la prosa de `.github/`, y el script sólo se invocaba desde
 * `package.json`; y corría la copia bajo `os.tmpdir()`, una ruta sin espacios,
 * donde la guarda rota SÍ dispara. Ahora lee las dos fuentes y la copia vive en
 * un directorio cuyo nombre lleva un espacio.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { withoutNestedCheckouts } from '../scaffold/nested-checkout.mjs'

/** Los directorios cuya prosa el ciclo inyecta o ejecuta. */
export const PROSE_DIRS = Object.freeze([
  '.github/instructions',
  '.github/prompts',
  '.github/agents',
  '.github/skills',
])

/** Una invocación real: `node` seguido de una ruta de script. */
export const SCRIPT_REF = /node\s+(scripts\/[A-Za-z0-9/_.-]+\.mjs)/g

/**
 * Rutas que se cuentan y se verifica que existan, pero NO se corren, cada una con
 * el motivo. Se listan en el reporte: un verde que omite algo tiene que decirlo.
 * Las cuatro entraron con `package.json` (C2), y correrlas sin argumentos tiene un
 * efecto que la copia no contiene o un costo que la cadena no puede pagar.
 */
export const NOT_RUN = Object.freeze({
  'scripts/multi-harness/entry-point-probe.mjs':
    'es esta compuerta: correrla dentro de su copia copiaría la copia, sin fin',
  'scripts/scaffold/mutation-ratchet.mjs':
    'sin argumentos corre la suite de mutantes de todas las áreas',
  'scripts/scaffold/installed-suite.mjs':
    'corre setup.sh, que escribe en el store compartido de ICM, fuera de la copia',
  'scripts/sdd-lifecycle/sdd-stress-suite.mjs':
    'sin --hermetic consulta el store compartido de ICM, fuera de la copia',
})

/** `true` cuando el módulo es un filtro de tubería y no un CLI de argumentos. */
export function readsStdin(source) {
  return /process\.stdin/.test(source)
}

/**
 * Clasifica el resultado de correr un script sin argumentos. **Pura**: el efecto
 * de correrlo queda afuera, así que cada rama se puede fijar con una entrada.
 *
 * @param {{ code: number, output: string, source: string }} run
 * @returns {'ok' | 'sin-respuesta'}
 */
export function classifyRun({ code, output, source }) {
  if (code !== 0) return 'ok' // Falla y lo dice: es un CLI con un argumento obligatorio
  if (output.trim().length > 0) return 'ok' // Imprime algo: responde
  if (readsStdin(source)) return 'ok' // Filtro de tubería: sin stdin no hay nada que emitir
  return 'sin-respuesta' // Sale 0 y no imprime: la línea de la prosa no hace nada
}

/** Recorre un directorio y devuelve los `.md`, recursivo. */
function markdownFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) markdownFiles(p, out)
    else if (p.endsWith('.md')) out.push(p)
  }
  return out
}

/** Agrega a `found` cada `node scripts/...` de `text`, salvo los `*.test.mjs`. */
function collectRefs(text, found) {
  for (const m of text.matchAll(SCRIPT_REF)) {
    if (!m[1].endsWith('.test.mjs')) found.add(m[1])
  }
}

/** Las rutas que los scripts de `package.json` corren con `node` (C2). */
export function packageScripts(root) {
  const file = path.join(root, 'package.json')
  if (!fs.existsSync(file)) return []
  const found = new Set()
  for (const command of Object.values(JSON.parse(fs.readFileSync(file, 'utf8')).scripts ?? {})) {
    collectRefs(String(command), found)
  }
  return [...found].sort()
}

/**
 * Las rutas de script que la prosa y `package.json` mandan correr con `node`.
 * Excluye los `*.test.mjs`: varios se invocan en la prosa y no son CLIs.
 */
export function invokedScripts(root, dirs = PROSE_DIRS) {
  const found = new Set(packageScripts(root))
  for (const dir of dirs) {
    const full = path.join(root, dir)
    if (!fs.existsSync(full)) continue
    for (const file of markdownFiles(full)) collectRefs(fs.readFileSync(file, 'utf8'), found)
  }
  return [...found].sort()
}

/**
 * Corre cada ruta sin argumentos y clasifica. El runner se inyecta para poder
 * fijar cada rama con una entrada en vez de con un subproceso.
 *
 * @param {{ root: string, sandbox?: string, run: (rel: string, cwd: string) => { code: number, output: string } }} opts
 * @returns {{ checked: number, silent: Array<{ file: string, code: number }>, missing: string[], skipped: Array<{ file: string, reason: string }> }}
 */
export function probeEntryPoints({ root, sandbox = root, run, notRun = NOT_RUN }) {
  const silent = []
  const missing = []
  const skipped = []
  const scripts = invokedScripts(root)

  for (const rel of scripts) {
    const abs = path.join(root, rel)
    if (!fs.existsSync(abs)) {
      missing.push(rel)
      continue
    }
    if (Object.hasOwn(notRun, rel)) {
      skipped.push({ file: rel, reason: notRun[rel] })
      continue
    }
    const { code, output } = run(rel, sandbox)
    const verdict = classifyRun({ code, output, source: fs.readFileSync(abs, 'utf8') })
    if (verdict === 'sin-respuesta') silent.push({ file: rel, code })
  }

  return { checked: scripts.length, silent, missing, skipped }
}

export function formatEntryPointReport(r) {
  const lines = ['=== AOI Entry Point Probe ===', '', `Rutas invocadas: ${r.checked}`]
  if (r.missing.length > 0) {
    lines.push(`❌ ${r.missing.length} ruta(s) que la prosa o package.json nombran y no existen:`)
    for (const m of r.missing) lines.push(`   · ${m}`)
  }
  if (r.silent.length > 0) {
    lines.push(`❌ ${r.silent.length} script(s) que la prosa o package.json mandan correr y NO responden:`)
    for (const s of r.silent) lines.push(`   · ${s.file} — sale 0 sin imprimir nada`)
    lines.push('   Falta el punto de entrada. Ver `synthesize-stubs.mjs` como referencia.')
  }
  const skipped = r.skipped ?? []
  if (r.missing.length === 0 && r.silent.length === 0) {
    lines.push(`✅ Cada ruta que la prosa o package.json invocan responde cuando se la corre (${r.checked - skipped.length} corridas).`)
  }
  if (skipped.length > 0) {
    lines.push(`⏭  ${skipped.length} ruta(s) existen pero NO se corrieron:`)
    for (const s of skipped) lines.push(`   · ${s.file} — ${s.reason}`)
  }
  return lines.join('\n')
}

/** El prefijo de la copia. Lleva un espacio: ver `sandboxCopy`. */
export const SANDBOX_PREFIX = 'aoi entrypoint-'

/** Una copia desechable del árbol, para no correr nada contra el repo del Owner. */
export function sandboxCopy(root) {
  const EXCLUDED = /(?:^|\/)(?:node_modules|\.git|\.nuxt|\.output|coverage|scaffold)(?:\/|$)/
  // El espacio en el nombre es deliberado (C2): sin él, una guarda de entrada
  // que concatena `'file://' + argv[1]` dispara en la copia y la compuerta no
  // ve que en el repositorio del Owner no dispara.
  const work = fs.mkdtempSync(path.join(os.tmpdir(), SANDBOX_PREFIX))
  try {
    fs.cpSync(root, work, {
      recursive: true,
      // Un checkout anidado (un worktree de Claude Code) es otro árbol: nested-checkout.mjs.
      filter: withoutNestedCheckouts(root, (src) => !EXCLUDED.test(path.relative(root, src))),
    })
  } catch (err) {
    // El `main` sólo borra `work` cuando la copia le DEVOLVIÓ: si `cpSync` falla
    // a mitad (permisos, ENOSPC), `work` sigue `undefined` y el `finally` no
    // alcanza al directorio huérfano. Se limpia donde se creó, que es el único
    // lugar que lo conoce. Medido: sin esto, un fallo de copia deja la copia.
    fs.rmSync(work, { recursive: true, force: true })
    throw err
  }
  return work
}

/** El runner real: un subproceso por ruta, con la entrada cerrada. */
export function spawnRunner(rel, cwd) {
  try {
    const output = execFileSync('node', [rel], {
      cwd,
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, output }
  } catch (e) {
    return { code: e.status ?? 1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

export function main() {
  const root = process.cwd()
  let work
  try {
    work = sandboxCopy(root)
    const report = probeEntryPoints({ root, sandbox: work, run: spawnRunner })
    process.stdout.write(`${formatEntryPointReport(report)}\n`)
    if (report.silent.length > 0 || report.missing.length > 0) process.exitCode = 1
  } finally {
    if (work) fs.rmSync(work, { recursive: true, force: true })
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
