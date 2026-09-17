/**
 * scripts/code-lens/determinism-classifier.mjs
 *
 * Asigna cada archivo fuente a una clase de determinismo, por evidencia léxica.
 *
 * Por qué existe. El índice de arquitectura tenía una matriz de determinismo
 * conceptualmente correcta pero clasificaba CLASES, no ARCHIVOS: se leía entera
 * sin poder responder "¿`context-arranger.mjs` es determinista?". El pedido
 * original era justamente el inverso —"cada archivo que vuelve el comportamiento
 * determinista y todo lo que no es determinista"— y esa pregunta sólo se
 * responde con una asignación por archivo.
 *
 * Por qué se deriva y no se escribe. La clase de un archivo cambia con un solo
 * import nuevo. Una tabla escrita a mano queda mintiendo desde ese commit y
 * nadie se entera; derivarla del texto la mantiene sincronizada por
 * construcción y cuesta cero tokens de inferencia.
 *
 * Regla de agregación: gana la señal MÁS no-determinista presente. Un módulo
 * que lee el filesystem y además consulta `process.env` no es "determinista
 * sobre estado fijado": el entorno lo puede mover sin que cambie un byte del
 * árbol, así que se clasifica por el entorno.
 *
 * Alcance honesto: esto detecta la superficie que el archivo TOCA, no la que
 * alcanza a través de sus dependencias. Un módulo puro que importa uno que lee
 * el filesystem se reporta como puro, y es correcto: el grafo de imports —que
 * emite `interaction-graph.mjs`— es el que propaga esa transitividad.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const EXTS = ['.mjs', '.js']
// No se filtra por el nombre 'scaffold': el espejo raíz queda afuera porque
// los recorridos se acotan a 'scripts/', y filtrarlo por nombre se comía además
// a 'scripts/scaffold/', que son fuentes legítimas de las compuertas de calidad.
const SKIP_DIRS = new Set(['node_modules', '.git', 'fixtures'])

/**
 * Clases ordenadas de más a menos no-determinista. La primera que coincide es
 * la que gana, así que el orden de este array ES la regla de precedencia.
 */
export const DETERMINISM_CLASSES = [
  {
    id: 'red-o-dependencias',
    label: 'Red / dependencias externas',
    frontier: 'Versiones, disponibilidad y contenido descargado no pertenecen al árbol AOI.',
    patterns: [/\bfetch\s*\(/, /from\s*['"]node:https?['"]/, /require\(['"]https?['"]\)/],
  },
  {
    id: 'proceso-o-entorno',
    label: 'Proceso / entorno externo',
    frontier: 'Depende de PATH, variables de entorno y binarios instalados fuera del repo.',
    patterns: [/from\s*['"]node:child_process['"]/, /\bexecSync\s*\(/, /\bspawnSync?\s*\(/, /\bprocess\.env\b/],
  },
  {
    id: 'tiempo-o-azar',
    label: 'Stateful con tiempo o azar',
    frontier: 'La estructura se valida mecánicamente, pero la salida no es byte-idéntica entre corridas.',
    patterns: [/new Date\s*\(/, /\bDate\.now\s*\(/, /\bMath\.random\s*\(/, /\bperformance\.now\s*\(/],
  },
  {
    id: 'estado-fijado',
    label: 'Determinista sobre estado fijado',
    frontier: 'Lógica reproducible, pero observa archivos, symlinks y permisos existentes.',
    patterns: [/from\s*['"]node:fs['"]/, /\bfs\.(read|write|exists|stat|readdir|rm|mkdir)/],
  },
]

export const PURE_CLASS = {
  id: 'puro-mecanico',
  label: 'Puro / mecánico',
  frontier: 'Igual entrada textual ⇒ igual veredicto o transformación.',
}

function walk(dir, keep, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, keep, out)
    else if (keep(entry.name)) out.push(full)
  }
  return out
}

/**
 * Quita comentarios de línea y de bloque antes de clasificar.
 *
 * No es cosmético: estos módulos documentan su propio comportamiento en prosa,
 * y una cabecera que EXPLICA por qué evita `Math.random()` contiene el patrón
 * que la clasificaría como azarosa. Clasificar sobre el texto crudo haría que
 * escribir buena documentación degrade la clase del archivo.
 */
export function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
}

/** Clasifica un texto fuente. Devuelve la clase y las señales que la fundan. */
export function classifySource(code) {
  const body = stripComments(code)
  for (const klass of DETERMINISM_CLASSES) {
    const signals = klass.patterns.filter((p) => p.test(body)).map((p) => p.source)
    if (signals.length) {
      return { class: klass.id, label: klass.label, frontier: klass.frontier, signals: signals.sort() }
    }
  }
  return { class: PURE_CLASS.id, label: PURE_CLASS.label, frontier: PURE_CLASS.frontier, signals: [] }
}

/** Clasifica todo un árbol de fuentes. Salida ordenada y estable. */
export function auditDeterminism(root, dir = 'scripts') {
  const sources = walk(path.join(root, dir), (n) => EXTS.includes(path.extname(n)) && !n.endsWith('.test.mjs'))
  const byFile = {}
  for (const file of sources.sort()) {
    const key = path.relative(root, file).split(path.sep).join('/')
    byFile[key] = classifySource(fs.readFileSync(file, 'utf8'))
  }
  return byFile
}

/** Resume cuántos archivos cae en cada clase, en el orden de precedencia. */
export function summarize(byFile) {
  const order = [...DETERMINISM_CLASSES.map((k) => k.id), PURE_CLASS.id]
  const counts = Object.fromEntries(order.map((id) => [id, 0]))
  for (const entry of Object.values(byFile)) counts[entry.class] += 1
  return order.map((id) => ({ class: id, count: counts[id] }))
}

function main() {
  const root = process.cwd()
  const byFile = auditDeterminism(root)
  if (process.argv.slice(2).includes('--summary')) {
    for (const { class: id, count } of summarize(byFile)) {
      process.stdout.write(`${String(count).padStart(4)}  ${id}\n`)
    }
    return
  }
  process.stdout.write(JSON.stringify(byFile, null, 2) + '\n')
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) main()
