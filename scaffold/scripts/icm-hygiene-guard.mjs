/**
 * scripts/icm-hygiene-guard.mjs
 *
 * Cuenta las memorias de ICM de este workspace que el recall no debería servir:
 * basura del extractor automático y memorias que citan rutas que ya no están.
 *
 * POR QUÉ EXISTE. `icm hook prompt` inyecta en cada prompt las memorias que
 * mejor matchean, sin mirar qué son. El extractor de ICM (las salidas de
 * herramientas que encola `icm hook post` y que un LLM procesa al cerrar la
 * sesión, más la extracción por reglas del transcript en `end`/`compact`) las
 * guarda en `context-<proyecto>` junto a las curadas. Medido el 2026-10-01 sobre
 * las 946 memorias con esa firma desde el 2026-09-08: 84 fragmentos sueltos de
 * salida ("✖ …", "66     // …", "Structured output provided successfully"),
 * 21 textos donde el extractor se niega a guardar algo guardados como memoria
 * ("The tool outputs contain routine build/test status…") y texto de `--help`.
 * Se purgaron a mano. Arreglar el emisor no retracta lo emitido: sin esta
 * cuenta, la próxima tanda se descubre igual, leyendo el recall.
 *
 * Las rutas: 155 memorias de `context-AOI` citaban `scripts/aoi-os/…`, que el
 * árbol ya no tiene, y el recall las servía como estado actual.
 *
 * POR QUÉ UN AVISO Y NUNCA UN FALLO. La base de ICM es del Owner y vive fuera
 * del repositorio: el doctor no puede repararla ni debería trancarse por ella.
 * Nombra cuántas hay y cómo encontrarlas; borrar es decisión del Owner.
 *
 * Determinista, 0 tokens de inferencia. Sólo lee (`icm --read-only list`).
 */

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { resolveWorkspaceName } from './memoir-naming-guard.mjs'

const execFileAsync = promisify(execFile)

/**
 * Las formas medidas de basura. Cada regla salió de una memoria real; ninguna
 * se dedujo. Se aplican sobre el `summary`.
 */
export const JUNK_RULES = {
  // El extractor explicando que no hay nada que guardar, guardado como memoria.
  refusal: /(?:^(?:These|The|The provided) (?:tool )?outputs? (?:are|contain|show))|(?:no durable (?:facts|architectural))/i,
  // Una línea suelta de la salida de una herramienta: número de línea, comentario
  // de código, string citado, glifos de `node --test`. El backtick NO: una
  // memoria curada empieza a menudo nombrando código ("`set` on an existing
  // key supersedes…") y la regla la marcaba como basura. Sólo cuenta debajo de
  // FRAGMENT_MAX caracteres, como en la purga: un fragmento es una línea.
  fragment: /^\s*(\d+\s*[:\s]\s*\S|\/\/|\/\*|\*\s|\*$|['"]|[✖✔ℹ▶]|Structured output provided successfully\s*$)/,
  // Una fila de `--help`: flag, columna de espacios, descripción.
  cliHelp: /^\s*-{1,2}[a-z][\w-]*(\s+<[^>]+>)?\s{2,}\S/,
  // La respuesta conversacional del LLM extractor, no un hecho.
  chatter: /^(Let me know what|Just let me know|Is there a specific task|I'm ready to|I can see you've provided)/i,
}

/** Por qué una memoria es basura, o null si ninguna regla la reconoce. */
export function junkKind(summary) {
  const s = String(summary ?? '')
  for (const [kind, re] of Object.entries(JUNK_RULES)) {
    if (kind === 'fragment' && s.length >= FRAGMENT_MAX) continue
    if (re.test(s)) return kind
  }
  return null
}

export const FRAGMENT_MAX = 140

// Una memoria que REGISTRA que un archivo se sacó no está vieja por citarlo:
// "eliminado ChatLanguageModel.example.json" es el hecho, no un estado viejo.
const REMOVAL = /\b(removed|deleted|dropped|no longer exists|eliminad[oa]s?|borrad[oa]s?|retirad[oa]s?|quitad[oa]s?|ya no existe)\b/i

// "README.md/README.es.md" son dos archivos, no un directorio README.md.
const FILE_SEGMENT = /^[^.].*\.[a-z]{1,5}$/
function splitAlternatives(rel) {
  const segs = rel.split('/')
  const firstFile = segs.findIndex((x) => FILE_SEGMENT.test(x))
  if (firstFile === -1 || firstFile === segs.length - 1) return [rel]
  const prefix = segs.slice(0, firstFile)
  return segs.slice(firstFile).map((f) => [...prefix, f].join('/'))
}

// Una ruta relativa con al menos un `/` y extensión de archivo.
// Cada segmento empieza con letra, dígito, `@`, `_` o `-`: "scripts/....mjs" es
// un ejemplo elidido en la memoria, no una ruta.
const PATH_TOKEN = /(?:^|[\s`'"([])((?:\.?[\w@-][\w.@-]*\/)+[\w-][\w.-]*\.[a-z]{1,5})(?=$|[\s`'"),.:;\]])/g

/**
 * Las rutas que la memoria cita y ninguna de las raíces tiene.
 *
 * Sólo se juzga una ruta cuyo primer segmento SÍ existe en alguna raíz:
 * "src/x.ts" de otro proyecto no es evidencia de nada acá, pero
 * "scripts/aoi-os/x.mjs" con `scripts/` presente y el archivo ausente es
 * exactamente la memoria vieja que el recall servía como actual. Raíces, en
 * plural: un worktree no tiene los archivos sin versionar del checkout
 * principal (.tasks/, propuestas sin commitear) y los daba por inexistentes.
 *
 * @param {string} summary
 * @param {string|string[]} roots
 * @param {(p: string) => boolean} [exists]
 */
export function stalePaths(summary, roots, exists = fs.existsSync) {
  const text = String(summary ?? '')
  if (REMOVAL.test(text)) return []
  const list = [].concat(roots)
  const anyHas = (rel) => list.some((r) => exists(path.join(r, rel)))
  const out = new Set()
  for (const m of text.matchAll(PATH_TOKEN)) {
    for (const rel of splitAlternatives(m[1].replace(/^\.\//, ''))) {
      if (!anyHas(rel.split('/')[0])) continue
      if (!anyHas(rel)) out.add(rel)
    }
  }
  return [...out]
}

/**
 * La raíz del checkout principal cuando `repoRoot` es un worktree (su
 * `--git-common-dir` es el `.git` de aquél), o null.
 */
export async function mainCheckoutRoot(repoRoot, execFn = execFileAsync) {
  try {
    const { stdout } = await execFn('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: repoRoot })
    const common = String(stdout).trim()
    if (!path.isAbsolute(common) || path.basename(common) !== '.git') return null
    const root = path.dirname(common)
    return fs.existsSync(root) && path.resolve(root) !== path.resolve(repoRoot) ? root : null
  } catch {
    return null
  }
}

/**
 * Los topics de este workspace. Dos convenciones conviven en la base: la del
 * protocolo de AOI (`<ws>-context`) y la de ICM, que es donde escribe su
 * extractor (`context-<proyecto>`, con el proyecto = nombre del directorio).
 */
export function workspaceTopics(workspace, dirName = workspace) {
  const names = [...new Set([workspace, dirName].filter(Boolean))]
  const topics = []
  for (const n of names) {
    for (const k of ['context', 'decisions', 'errors-resolved', 'preferences']) topics.push(`${n}-${k}`)
    topics.push(`context-${n}`, `decisions-${n}`)
  }
  return [...new Set(topics)]
}

/** Clasifica memorias ya leídas. Exportada para fijarla sin ICM. */
export function classifyMemories(memories, roots, exists = fs.existsSync) {
  const junk = []
  const stale = []
  for (const m of memories) {
    const kind = junkKind(m?.summary)
    if (kind) {
      junk.push({ id: m.id, topic: m.topic, kind })
      continue
    }
    const paths = stalePaths(m?.summary, roots, exists)
    if (paths.length > 0) stale.push({ id: m.id, topic: m.topic, paths })
  }
  return { junk, stale }
}

function parseList(stdout) {
  try {
    const data = JSON.parse(String(stdout ?? ''))
    return Array.isArray(data) ? data : null
  } catch {
    return null
  }
}

const count = (items, key) => {
  const c = {}
  for (const i of items) c[i[key]] = (c[i[key]] ?? 0) + 1
  return Object.entries(c)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k, n]) => `${n} ${k}`)
    .join(', ')
}

/**
 * @param {string} repoRoot
 * @param {Function} [execFn]
 * @returns {Promise<{ status: string, details: string, junk?: object[], stale?: object[], topics?: string[] }>}
 */
export async function checkIcmHygiene(repoRoot, execFn = execFileAsync) {
  const workspace = await resolveWorkspaceName(repoRoot, execFn)
  const topics = workspaceTopics(workspace, path.basename(path.resolve(repoRoot)))
  const memories = []
  const errors = []
  for (const topic of topics) {
    try {
      const { stdout } = await execFn('icm', ['--read-only', 'list', '-t', topic, '-a', '-f', 'json'])
      const rows = parseList(stdout)
      if (rows) memories.push(...rows)
      else errors.push(`${topic}: salida que no es JSON`)
    } catch (error) {
      errors.push(`${topic}: ${String(error?.message ?? error).split('\n')[0]}`)
    }
  }

  // "No pude leer" no es "no hay basura": sin esta rama, un ICM ausente
  // reportaría una base limpia que nadie abrió.
  if (memories.length === 0 && errors.length > 0) {
    return { status: 'WARNING', details: `no se pudo leer ICM (${errors[0]})`, topics }
  }

  const mainRoot = await mainCheckoutRoot(repoRoot, execFn)
  const { junk, stale } = classifyMemories(memories, mainRoot ? [repoRoot, mainRoot] : [repoRoot])
  if (junk.length === 0 && stale.length === 0) {
    return { status: 'PASSED', details: `${memories.length} memoria(s) en ${topics.length} topic(s), sin basura ni rutas inexistentes`, junk, stale, topics }
  }
  const parts = []
  if (junk.length) parts.push(`${junk.length} basura del extractor (${count(junk, 'kind')})`)
  if (stale.length) parts.push(`${stale.length} citan rutas que ya no existen (${count(stale, 'topic')})`)
  return {
    status: 'WARNING',
    details: `${parts.join('; ')} de ${memories.length} — el recall las sirve como actuales. Listarlas: node scripts/icm-hygiene-guard.mjs --list; borrarlas es decisión del Owner (icm forget <id>)`,
    junk,
    stale,
    topics,
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
if (isMain) {
  const args = process.argv.slice(2)
  const unknown = args.filter((a) => a !== '--list')
  if (unknown.length > 0) {
    console.error(`flag desconocido: ${unknown[0]}\nUso: icm-hygiene-guard.mjs [--list]`)
    process.exit(2)
  }
  const r = await checkIcmHygiene(process.cwd())
  console.log(`${r.status}: ${r.details}`)
  if (args.includes('--list')) {
    for (const j of r.junk ?? []) console.log(`  basura  ${j.id}  ${j.topic}  ${j.kind}`)
    for (const s of r.stale ?? []) console.log(`  ruta    ${s.id}  ${s.topic}  ${s.paths.join(' ')}`)
  }
}
