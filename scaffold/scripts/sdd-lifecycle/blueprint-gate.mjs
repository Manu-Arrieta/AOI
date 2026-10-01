/**
 * scripts/sdd-lifecycle/blueprint-gate.mjs
 *
 * Compuerta mecánica de CLAUSURA del System Blueprint Contract (SBC).
 *
 * El Gate de Génesis aprueba COHERENCIA, no correctitud: que el grafo esté
 * cerrado —todo componente con frontera declarada y todo cruce de frontera con
 * un flujo nombrado— y que no haya contradicciones estructurales. La correctitud
 * la da la Tracer Bullet, y sólo ella.
 *
 * Consume cero tokens de inferencia: los cruces son hechos O(1) en ICM, no
 * prosa que un LLM tenga que interpretar.
 *
 * Hermano de `invariant-gate.mjs`: aquél cruza invariantes de un BIC contra la
 * suite de tests; éste cruza la estructura de un SBC contra sí misma. El mismo
 * patrón —un tag declarado que algo mecánico tiene que encontrar— aplicado a
 * fronteras en vez de a reglas.
 */

import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { findArchifyRenderer } from '../doctor-checks.mjs'
import { collectBlueprints } from './blueprint-facts.mjs'
import { resolveWorkspaceEntity } from './workspace-identity.mjs'
import {
  auditDiagramArtifacts,
  diagramObligation,
  formatDiagramObligation,
  parseGateArgs,
  readSbcFacts,
  recordObligation,
} from './blueprint-diagram.mjs'

// Re-exported: la obligación de diagrama se separó a `blueprint-diagram.mjs`
// cuando este archivo se acercó al Invariante 5, y el corte es un límite real —
// decidir QUÉ se debe es una pregunta distinta de auditar si el grafo está
// cerrado. Los llamadores siguen importando desde acá.
export { diagramObligation, auditDiagramArtifacts }

// Re-exported: la Fase -2 como unidad medible se separó a `genesis-phase.mjs`
// porque `sdd-stress-suite.mjs` estaba en 299 LOC con el Invariante 5 cortando en
// 300, y una fase inline no entraba. Mismo precedente que `invariant-gate.mjs`
// con `test-reachability.mjs`: el corte es interno y el llamador no debería
// enterarse de dónde cayó.
export { runGenesisPhase, BLUEPRINT_FIXTURE, BLUEPRINT_PROSE, blueprintFactsText } from './genesis-phase.mjs'

// Re-exported: leer los hechos `sbc.*` y darles forma se separó a
// `blueprint-facts.mjs` el 2026-09-27, cuando la lectura de la sucesión entre
// contratos llevó a ESTE archivo a 336 LOC contra el Invariante 5 —ya venía en
// 290, o sea al borde—. El corte es real y la cabecera de `blueprint-facts.mjs`
// lo argumenta; acá va sólo el re-export para que los llamadores no cambien.
export {
  CONTEXTS_KEY_PATTERN,
  NEVER_KEY_PATTERN,
  CROSSING_KEY_PATTERN,
  TRACER_KEY_PATTERN,
  PREDECESSOR_KEY_PATTERN,
  SBC_ID_IN_VALUE,
  parseCrossingValue,
  collectBlueprints,
} from './blueprint-facts.mjs'

/** Normaliza para comparar polaridad: quita el cuantificador y baja a minúsculas. */
function subjectOf(statement) {
  return String(statement)
    .replace(/^\s*(NUNCA|NEVER|SIEMPRE|ALWAYS|JAM[ÁA]S)\b/i, '')
    .replace(/[.;,\s]+$/g, '')
    .toLowerCase()
    .trim()
}

function polarityOf(statement) {
  return /^\s*(NUNCA|NEVER|JAM[ÁA]S)\b/i.test(String(statement)) ? 'negative' : 'positive'
}

/**
 * Audita la clausura de UN blueprint. Puro: no sabe de dónde vinieron los hechos.
 *
 * Las cinco aserciones separan lo ESTRUCTURAL (mecánico) de lo SEMÁNTICO (juicio
 * humano). Sólo se emite veredicto sobre lo primero — fingir que un contador
 * juzga si un invariante contradice la constitución sería exactamente el falso
 * verde que esta compuerta existe para evitar.
 *
 * @returns {{ sbcId: string, status: 'PASSED'|'FAILED', checks: Array<{ id: string,
 *   label: string, ok: boolean, detail: string, mechanical: boolean }> }}
 */
export function auditBlueprintClosure(blueprint) {
  const { sbcId, contexts = [], globals = [], crossings = [], tracer = '' } = blueprint ?? {}
  const problems = []
  const checks = []

  const add = (id, label, ok, detail) => {
    checks.push({ id, label, ok, detail, mechanical: true })
    if (!ok) problems.push(`${id}: ${detail}`)
  }

  // 1. Sin referencias colgadas: todo extremo de un cruce nombra un contexto declarado.
  //    El mensaje nombra el EXTREMO desconocido, no sólo el tag: "crossing.1 está
  //    mal" obliga a releer el hecho, "no declarado: fantasma" dice qué arreglar.
  const dangling = []
  for (const c of crossings) {
    if (!c.parsed) {
      dangling.push(`${c.tag} (formato inválido, se espera "origen -> destino: flujo")`)
      continue
    }
    const unknown = [c.parsed.from, c.parsed.to].filter((end) => !contexts.includes(end))
    if (unknown.length > 0) dangling.push(`${c.tag} -> no declarado: ${unknown.join(', ')}`)
  }
  add(
    'closure.endpoints',
    'Todo cruce referencia contextos declarados',
    dangling.length === 0,
    dangling.length ? `cruces colgados: ${dangling.join(' | ')}` : `${crossings.length} cruce(s) con extremos válidos`,
  )

  // 2. Todo cruce tiene flujo nombrado: un cruce anónimo es una integración no escrita.
  const unnamed = crossings.filter((c) => !c.parsed || !c.parsed.flow).map((c) => c.tag)
  add(
    'closure.flows',
    'Todo cruce tiene flujo nombrado',
    unnamed.length === 0,
    unnamed.length ? `cruces sin flujo: ${unnamed.join(', ')}` : 'todos los cruces nombran su flujo',
  )

  // 3. Un sistema partido sin integración declarada no está cerrado.
  const needsCrossing = contexts.length >= 2 && crossings.length === 0
  add(
    'closure.integration',
    'Un sistema con 2+ contextos declara al menos un cruce',
    !needsCrossing,
    needsCrossing ? `${contexts.length} contextos y cero cruces: no se declaró ninguna integración` : 'integración declarada',
  )

  // 4. Linter de invariantes: duplicado literal, o par polarizado sobre el mismo sujeto.
  const seen = new Map()
  const dupes = []
  const polarized = []
  for (const g of globals) {
    const subject = subjectOf(g.statement)
    if (!subject) continue
    if (seen.has(subject) && seen.get(subject).polarity !== polarityOf(g.statement)) {
      polarized.push(`${seen.get(subject).tag} vs ${g.tag}`)
    } else if (seen.has(subject)) {
      dupes.push(g.tag)
    }
    seen.set(subject, { tag: g.tag, polarity: polarityOf(g.statement) })
  }
  add(
    'closure.invariants',
    'Sin invariantes duplicados ni pares polarizados',
    dupes.length === 0 && polarized.length === 0,
    dupes.length || polarized.length
      ? [dupes.length ? `duplicados: ${dupes.join(', ')}` : '', polarized.length ? `polarizados: ${polarized.join(', ')}` : '']
          .filter(Boolean)
          .join(' · ')
      : `${globals.length} invariante(s) sin colisión estructural`,
  )

  // 5. Tracer Bullet declarada: sin ella no hay forma de validar la hipótesis.
  add(
    'closure.tracer',
    'Tracer Bullet declarada',
    Boolean(tracer),
    tracer ? 'declarada' : 'no se declaró ninguna rebanada vertical',
  )

  const status = problems.length > 0 ? 'FAILED' : 'PASSED'
  return { sbcId, status, checks }
}

export function formatBlueprintGateReport(audits = [], entity = '') {
  if (audits.length === 0) {
    return `## Blueprint Gate: ⏭️ SKIPPED\nNo \`sbc.*\` facts found for ${entity ? `"${entity}"` : 'this workspace'}.`
  }

  const lines = []
  for (const audit of audits) {
    const icon = audit.status === 'PASSED' ? '✅' : '🛑'
    lines.push(`## Blueprint Gate: ${icon} ${audit.status} — ${audit.sbcId}`, '')
    for (const c of audit.checks) {
      lines.push(`- ${c.ok ? '✅' : '🛑'} **${c.label}** — ${c.detail}`)
    }
    lines.push('')
  }

  lines.push(
    '> Las cinco aserciones son **estructurales**. No juzgan si un invariante contradice la',
    '> constitución ni si la Tracer Bullet es de verdad vertical: eso es humano.',
  )
  return lines.join('\n')
}

// ── CLI ──────────────────────────────────────────────────────────────────────

export function main(argv = process.argv.slice(2)) {
  let parsed
  try {
    parsed = parseGateArgs(argv)
  } catch (err) {
    // Flag desconocido: fallar fuerte. Ignorarlo convertiría un typo en una
    // corrida que reporta "sin workspace", y sin workspace la compuerta no
    // puede afirmar cumplimiento — o sea, un typo degradaría a un reporte que
    // se lee como si no hubiera nada pendiente.
    console.error(`\n❌ ${err.message}\n`)
    process.exitCode = 2
    return { audits: [], diagramFailures: [], archifyAvailable: false, exitCode: 2 }
  }

  const { positional, workspaceRoot, dbPath, record, chain } = parsed
  // La entidad se resuelve como en el Invariant Gate (remoto origin, luego el
  // directorio): con `basename(cwd)` un worktree auditaba una entidad inexistente.
  let entity = positional[0]
  if (!entity) {
    const resolved = resolveWorkspaceEntity(process.cwd(), 'Blueprint Gate')
    process.stderr.write(resolved.notice)
    entity = resolved.entity
  }
  const read = readSbcFacts(entity, dbPath)
  if (!read.ok) {
    // "No pude leer" no es "no hay SBC". Con `--chain` la ausencia (sin `icm`,
    // entidad desconocida) sale 0 como en el Invariant Gate; una avería, nunca.
    console.log(`## Blueprint Gate: ⏭️ NOT AUDITED\nNo se pudo leer el SBC de "${entity}": ${read.reason}. Nada se dio por cerrado.`)
    process.exitCode = chain && read.absent ? 0 : 2
    return { audits: [], diagramFailures: [], archifyAvailable: false, exitCode: process.exitCode, notAudited: read.reason }
  }
  const blueprints = collectBlueprints(read.facts)
  const audits = blueprints.map(auditBlueprintClosure)

  console.log(formatBlueprintGateReport(audits, entity))

  // La detección de Archify es la MISMA que usa el doctor: una sola respuesta
  // para "¿está instalado?" evita que la compuerta y el doctor divergan.
  const archifyAvailable = Boolean(findArchifyRenderer())

  const diagramFailures = []
  for (const blueprint of blueprints) {
    const obligation = diagramObligation(blueprint, { archifyAvailable })
    // Sin `--workspace` no hay artefactos que auditar: el gate corre en el repo
    // y el blueprint vive en el workspace. Ausencia de auditoría NO se reporta
    // como cumplimiento.
    const artifacts = workspaceRoot ? auditDiagramArtifacts(workspaceRoot, blueprint.sbcId) : null
    console.log(formatDiagramObligation(blueprint.sbcId, obligation, artifacts))

    // Duro sólo donde la herramienta existe: ahí producir el diagrama es barato
    // y el camino correcto es el que menos cuesta. Sin Archify se reporta y no
    // se bloquea, porque la salida barata sería borrar el cruce.
    if (obligation.enforce && artifacts && !artifacts.present) {
      diagramFailures.push(blueprint.sbcId)
    }

    if (record) console.log(recordObligation(entity, blueprint.sbcId, obligation, dbPath))
  }

  if (record && !workspaceRoot) {
    console.log('\n> `--record` sin `--workspace`: se registró la obligación declarada, no su cumplimiento.')
  }

  const failed = audits.some((a) => a.status === 'FAILED') || diagramFailures.length > 0
  process.exitCode = failed ? 1 : 0
  return { audits, diagramFailures, archifyAvailable, exitCode: process.exitCode }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) main()
