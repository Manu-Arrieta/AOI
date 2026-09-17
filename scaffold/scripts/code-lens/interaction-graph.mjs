/**
 * scripts/code-lens/interaction-graph.mjs
 *
 * Emite el grafo de invocación de AOI: quién llama a quién, en qué orden.
 *
 * Por qué existe. El índice de arquitectura describía el sistema como una
 * TAXONOMÍA —áreas de scripts, contratos, clases de determinismo— y esa forma
 * miente por omisión. Un módulo puede figurar como un ítem más de una lista de
 * once y ser en realidad el punto donde convergen catorce módulos de cuatro
 * áreas distintas; otro puede estar clasificado en un área y depender de otra.
 * Ninguna de las dos cosas se ve en una tabla por carpetas, y son exactamente
 * las que determinan qué se rompe cuando alguien toca un archivo.
 *
 * Por qué es un script y no prosa. La misma información escrita a mano se
 * desactualiza en el commit siguiente y cuesta tokens de inferencia cada vez
 * que alguien la lee para verificarla. Acá el costo de inferencia es cero: el
 * grafo se deriva del árbol por regex y la salida es estable —listas ordenadas,
 * rutas relativas al repo— para que dos corridas sobre el mismo árbol produzcan
 * bytes idénticos y un diff señale un cambio real de arquitectura.
 *
 * Alcance honesto: esto es extracción léxica, no análisis semántico. Ve la
 * arista que está escrita en el texto. Un `import()` dinámico armado con una
 * variable no aparece, y eso es una limitación declarada, no un descuido.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const EXTS = ['.mjs', '.js']
// No se filtra por el nombre 'scaffold': el espejo raíz queda afuera porque
// los recorridos se acotan a 'scripts/', y filtrarlo por nombre se comía además
// a 'scripts/scaffold/', que son fuentes legítimas de las compuertas de calidad.
const SKIP_DIRS = new Set(['node_modules', '.git', 'fixtures'])

/** Recorre un directorio y devuelve rutas absolutas que cumplan `keep`. */
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

const rel = (root, abs) => path.relative(root, abs).split(path.sep).join('/')

/**
 * Comparación por unidad de código, NO `localeCompare`.
 *
 * Parece un detalle y es el corazón del módulo: `localeCompare` consulta el
 * locale del proceso, así que el mismo árbol ordenado en dos máquinas con ICU
 * distinto produce dos salidas distintas. Un generador cuya promesa es "mismo
 * árbol ⇒ mismos bytes" no puede apoyarse en algo que el entorno decide.
 */
const byCodeUnit = (a, b) => Number(a > b) - Number(a < b)

/** El `.sort()` sin comparador ya ordena strings por unidad de código. */
const uniqSorted = (values) => [...new Set(values)].sort()

function readIfPresent(root, relPath) {
  const full = path.join(root, relPath)
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null
}

/**
 * Aristas prompt → ejecutable. Un prompt del ciclo SDD es un orquestador: su
 * valor operativo está en QUÉ invoca y con qué herramientas externas cuenta.
 */
export function promptInvocations(root) {
  const dir = path.join(root, '.github/prompts')
  const files = walk(dir, (n) => n.endsWith('.prompt.md'))
  const edges = {}
  for (const file of files.sort()) {
    const text = fs.readFileSync(file, 'utf8')
    const name = path.basename(file, '.prompt.md')
    const scripts = uniqSorted(
      [...text.matchAll(/node\s+(scripts\/[A-Za-z0-9/_-]+\.mjs)/g)].map((m) => m[1]),
    )
    const commands = uniqSorted(
      [...text.matchAll(/pnpm\s+((?:aoi:|test)[A-Za-z0-9:-]*)/g)].map((m) => `pnpm ${m[1]}`),
    )
    const tools = uniqSorted(
      [...text.matchAll(/\b(icm|rtk)\s+([a-z][a-z-]*)/g)].map((m) => `${m[1]} ${m[2]}`),
    )
    const agents = uniqSorted([...text.matchAll(/@([a-z][a-z-]*[a-z])\b/g)].map((m) => m[1]))
    if (scripts.length || commands.length || tools.length || agents.length) {
      edges[name] = { scripts, commands, tools, agents }
    }
  }
  return edges
}

/**
 * Especificadores relativos, en las dos formas que usa ESM: el import con
 * binding (`import x from './a.mjs'`, y también `export … from`) y el import de
 * side-effect (`import './a.mjs'`), que no lleva `from` y que un patrón anclado
 * en esa palabra pierde en silencio. Un `import()` dinámico queda afuera a
 * propósito: su argumento puede ser una variable y no hay arista que leer.
 */
const IMPORT_SPEC = /(?:from|import)\s*['"](\.[^'"]+)['"]/g

/** Resuelve un especificador relativo contra el archivo que lo importa. */
function resolveImport(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec)
  for (const candidate of [base, ...EXTS.map((e) => base + e)]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  }
  return null
}

/**
 * Aristas módulo → módulo. Sólo imports relativos que RESUELVEN a un archivo
 * real: así una ruta citada dentro de un string de ayuda o de un mensaje de
 * error no se cuela como dependencia falsa.
 */
export function moduleImports(root, dir = 'scripts') {
  const sources = walk(path.join(root, dir), (n) => EXTS.includes(path.extname(n)) && !n.endsWith('.test.mjs'))
  const edges = {}
  for (const file of sources.sort()) {
    const text = fs.readFileSync(file, 'utf8')
    const targets = []
    for (const m of text.matchAll(IMPORT_SPEC)) {
      const resolved = resolveImport(file, m[1])
      if (resolved && resolved !== file) targets.push(rel(root, resolved))
    }
    const key = rel(root, file)
    if (targets.length) edges[key] = uniqSorted(targets)
  }
  return edges
}

/** Invierte el grafo de imports para responder "¿quién depende de esto?". */
export function importDependents(edges) {
  const inverted = {}
  for (const [source, targets] of Object.entries(edges)) {
    for (const target of targets) (inverted[target] ??= []).push(source)
  }
  return Object.fromEntries(
    Object.entries(inverted)
      .map(([k, v]) => [k, uniqSorted(v)])
      .sort(([a], [b]) => byCodeUnit(a, b)),
  )
}

/**
 * Cadena de hooks por evento del harness. El ORDEN importa y es el del array:
 * en `PreToolUse(Bash)` la memoria se consulta antes de que RTK reescriba el
 * comando, y ése es el mecanismo real de ahorro de tokens del sistema.
 */
export function hookChain(root, settingsPath = '.claude/settings.json') {
  const raw = readIfPresent(root, settingsPath)
  if (!raw) return {}
  const parsed = JSON.parse(raw)
  const chain = {}
  for (const [event, groups] of Object.entries(parsed.hooks ?? {})) {
    chain[event] = []
    for (const group of groups) {
      for (const hook of group.hooks ?? []) {
        chain[event].push({
          matcher: group.matcher ?? '*',
          command: hook.command,
          timeout: hook.timeout ?? null,
        })
      }
    }
  }
  return chain
}

/**
 * Declaraciones de hook en `.github/hooks/`, que son la FUENTE ÚNICA.
 *
 * `.claude/settings.json` —lo que lee `hookChain`— no se escribe a mano: lo
 * compila `install-hooks.mjs` desde estos archivos. Leer sólo el compilado
 * describía el efecto y escondía la causa, y esa es justamente la costura donde
 * una configuración puede divergir de lo que el repositorio declara.
 */
export function hookDeclarations(root, dir = '.github/hooks') {
  const files = walk(path.join(root, dir), (n) => n.endsWith('.json'))
  const declared = {}
  for (const file of files.sort()) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    for (const [event, entries] of Object.entries(parsed.hooks ?? {})) {
      for (const entry of entries) {
        ;(declared[event] ??= []).push({ source: rel(root, file), command: entry.command })
      }
    }
  }
  return declared
}

/** Comando npm → script que ejecuta, y la cadena secuencial de `pnpm test`. */
export function commandMap(root) {
  const raw = readIfPresent(root, 'package.json')
  if (!raw) return { commands: {}, testChain: [] }
  const scripts = JSON.parse(raw).scripts ?? {}
  const commands = {}
  for (const [name, body] of Object.entries(scripts).sort(([a], [b]) => byCodeUnit(a, b))) {
    const targets = uniqSorted([...body.matchAll(/(scripts\/[A-Za-z0-9/_*-]+\.(?:mjs|sh))/g)].map((m) => m[1]))
    commands[name] = { body, targets }
  }
  const testChain = (scripts.test ?? '')
    .split('&&')
    .map((step) => step.trim())
    .filter(Boolean)
  return { commands, testChain }
}

/**
 * Fases del instalador en orden de ejecución. El ancla es `header "..."` y no
 * el comentario de banner: `header` es lo que el instalador IMPRIME, así que la
 * secuencia extraída es la que un Owner ve en pantalla.
 */
export function installerPhases(root, file = 'setup.sh') {
  const text = readIfPresent(root, file)
  if (!text) return []
  return [...text.matchAll(/^[ \t]*header[ \t]+"([^"]+)"/gm)].map((m) => m[1])
}

/** Ensambla el grafo completo. Salida estable: mismo árbol ⇒ mismos bytes. */
export function buildInteractionGraph(root) {
  const imports = moduleImports(root)
  const { commands, testChain } = commandMap(root)
  return {
    prompts: promptInvocations(root),
    imports,
    dependents: importDependents(imports),
    hookDeclarations: hookDeclarations(root),
    hooks: hookChain(root),
    commands,
    testChain,
    installerPhases: installerPhases(root),
  }
}

/** Módulos con más dependencias salientes: los puntos de integración reales. */
export function hubs(graph, limit = 10) {
  return Object.entries(graph.imports)
    .map(([module, targets]) => ({ module, fanOut: targets.length }))
    .sort((a, b) => b.fanOut - a.fanOut || byCodeUnit(a.module, b.module))
    .slice(0, limit)
}

/** Ciclos de import. Un ciclo no es fatal en ESM, pero no puede ser invisible. */
export function importCycles(graph) {
  const cycles = []
  const seen = new Set()
  for (const [source, targets] of Object.entries(graph.imports)) {
    for (const target of targets) {
      if (!graph.imports[target]?.includes(source)) continue
      const key = [source, target].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)
      cycles.push([source, target].sort())
    }
  }
  return cycles.sort(([a], [b]) => byCodeUnit(a, b))
}

function main() {
  const root = process.cwd()
  const graph = buildInteractionGraph(root)
  const args = process.argv.slice(2)
  if (args.includes('--hubs')) {
    for (const { module, fanOut } of hubs(graph)) {
      process.stdout.write(`${String(fanOut).padStart(3)}  ${module}\n`)
    }
    return
  }
  if (args.includes('--cycles')) {
    const cycles = importCycles(graph)
    for (const [a, b] of cycles) process.stdout.write(`CICLO  ${a}  <->  ${b}\n`)
    if (!cycles.length) process.stdout.write('Sin ciclos de import.\n')
    return
  }
  process.stdout.write(JSON.stringify(graph, null, 2) + '\n')
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) main()
