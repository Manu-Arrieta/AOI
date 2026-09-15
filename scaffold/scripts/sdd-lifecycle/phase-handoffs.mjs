#!/usr/bin/env node
/**
 * scripts/sdd-lifecycle/phase-handoffs.mjs
 *
 * Verifies that what one phase produces is what the next one can consume.
 *
 * The behavioural eval checks decisions INSIDE a phase. It cannot see the
 * failure that only appears between two: a phase that requires `design.md`
 * while no earlier phase ever writes it, or a producer that renames an
 * artifact its consumer still asks for by the old name. That break is silent
 * — each prompt reads perfectly on its own — and it only surfaces mid-cycle,
 * when the work to that point is already spent.
 *
 * Running a real cycle would also find it, at the price of six phases of
 * inference. This finds it by reading the prompts: every required artifact
 * must be produced by an earlier phase, every declared producer must actually
 * say it writes the file, and every consumer must actually say it reads it.
 * Zero inference tokens, and it runs inside `pnpm test`.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PROMPT = (name) => `.github/prompts/${name}.prompt.md`

/**
 * The artifact contract of each phase, in lifecycle order.
 *
 * `produces` is what the phase writes for someone downstream. `requires` is
 * what it needs from upstream and cannot proceed without. Optional inputs are
 * deliberately absent: an artifact listed here is a hard dependency, and the
 * checker treats a missing producer as a broken chain.
 */
export const HANDOFFS = [
  {
    phase: 'Phase_-2_Genesis',
    prompt: PROMPT('sdd-genesis'),
    // El SBC también viaja por ICM: son hechos O(1), y los cruces de frontera
    // son lo que cuenta la compuerta de clausura. El artefacto en prosa
    // (`blueprint.md`) vive en el WORKSPACE y no se declara acá — este checker
    // lee el prompt del repo, y un archivo que no está en el repo no se puede
    // verificar.
    produces: ['sbc-facts'],
    requires: [],
  },
  {
    phase: 'Phase_0_Frame',
    prompt: PROMPT('sdd-frame'),
    // Zero-Task Footprint: the only thing that crosses to the next phase is
    // the contract itself, persisted as O(1) facts rather than as a file.
    produces: ['bic-facts'],
    // Los invariantes GLOBALES del SBC rigen cada BIC. Se declaraba que Genesis
    // los persistía y ningún consumidor los pedía, así que nada notaba que
    // `/sdd-frame` no los leía: el propósito central del SBC viajaba a ICM y
    // moría ahí.
    requires: ['sbc-facts'],
  },
  {
    phase: 'Phase_1_New',
    prompt: PROMPT('sdd-new'),
    produces: ['proposal.md', 'registry.md'],
    requires: [],
  },
  {
    phase: 'Phase_2_FF',
    prompt: PROMPT('sdd-ff'),
    produces: ['spec.md', 'design.md', 'tasks.md', 'implementation-plan.md'],
    requires: ['proposal.md'],
  },
  {
    phase: 'Phase_3_Apply',
    prompt: PROMPT('sdd-apply'),
    produces: [],
    // Los diagramas NO son dependencia dura: se producen sólo si el SBC declaró
    // cruces Y Archify está instalado. Por eso `conditionalProduces` y no
    // `produces` — una lista de dependencias duras que exija un diagrama en
    // todo ciclo obligaría a inventar artefactos donde no hay integración.
    conditionalProduces: ['blueprint-diagrams'],
    requires: ['spec.md', 'design.md', 'tasks.md', 'implementation-plan.md', 'sbc-facts'],
  },
  {
    phase: 'Phase_4_Verify',
    prompt: PROMPT('sdd-verify'),
    produces: ['verify-report.md'],
    // The Invariant Gate reads the contract the Pre-Flight persisted, which is
    // the one handoff that travels through ICM instead of through disk.
    requires: ['spec.md', 'design.md', 'tasks.md', 'bic-facts', 'sbc-facts'],
    // El Blueprint Gate audita los diagramas CUANDO existen. Exigirlos como
    // dependencia dura convertiría un artefacto condicional en obligatorio.
    conditionalRequires: ['blueprint-diagrams'],
  },
  {
    phase: 'Phase_5_Archive',
    prompt: PROMPT('sdd-archive'),
    produces: ['archive-report.md', 'functional-docs.md'],
    requires: ['verify-report.md'],
  },
]

/**
 * How an artifact is recognised inside a prompt.
 *
 * La mayoría son nombres de archivo y se buscan literales. Los que no lo son
 * llevan un marcador propio, y por la misma razón en los dos casos: el nombre
 * declarado acá es el nombre de la DEPENDENCIA, no necesariamente el texto que
 * un prompt escribiría.
 *
 *   - `bic-facts` / `sbc-facts` son familias de hechos O(1): se reconocen por su
 *     prefijo de clave (`bic.`, `sbc.`), no por un archivo.
 *   - `blueprint-diagrams` son artefactos del WORKSPACE: el prompt nombra el
 *     directorio (`.blueprints/{SBC}/diagrams/`), nunca el guion del nombre.
 *
 * El prefijo es exactamente `bic.` y `sbc.`, y no `/bic|icm facts/i`. La versión
 * anterior aceptaba `icm facts` como señal, y los SIETE prompts del ciclo dicen
 * "icm facts" — así que `mentions()` devolvía verdadero siempre y las dos listas
 * que dependen de él (`silentProducers`, `silentConsumers`) no podían dispararse
 * nunca. Un check que no puede fallar no es un check.
 */
const ARTIFACT_MARKERS = {
  'bic-facts': /bic\./i,
  'sbc-facts': /sbc\./i,
  'blueprint-diagrams': /\.blueprints\/|diagrams\//i,
}

function mentions(text, artifact) {
  const marker = ARTIFACT_MARKERS[artifact]
  if (marker) return marker.test(text)
  return text.includes(artifact)
}

/**
 * Todo lo que una fase EXIGE, duro o condicional. Una sola definición.
 *
 * El display usaba `s.requires` directo mientras el auditor usaba esta lista
 * expandida, así que la pantalla imprimía `Phase_3_Apply → —` — "no produce
 * nada" — mientras el auditor sí veía su `blueprint-diagrams`. La auditoría lo
 * veía y el reporte lo escondía: el operador leía una cadena más pobre que la
 * que el gate verificaba.
 */
const REQUIRED = (s) => [...(s.requires ?? []), ...(s.conditionalRequires ?? [])]

/** Todo lo que una fase PRODUCE, duro o condicional. Misma razón que arriba. */
const PRODUCED = (s) => [...(s.produces ?? []), ...(s.conditionalProduces ?? [])]

/**
 * Audits the chain.
 *
 * `conditionalProduces`/`conditionalRequires` son artefactos que cruzan entre
 * fases SÓLO bajo una condición (un diagrama existe si el SBC declaró cruces y
 * Archify está instalado). Se verifican igual que los duros —la cadena tiene que
 * cerrar y el prompt tiene que nombrarlos— pero no se exige su presencia en todo
 * ciclo.
 *
 * `orphanProduces` es la dirección que faltaba: un artefacto que una fase dice
 * producir y NINGUNA posterior pide. Es exactamente cómo los invariantes
 * globales del SBC viajaban a ICM y morían ahí: el checker miraba sólo si lo
 * requerido tenía productor, nunca si lo producido tenía consumidor.
 *
 * Es un aviso y no un fallo, y esa distinción es deliberada: `registry.md` lo
 * produce `/sdd-new` y no lo requiere ninguna fase porque es un documento vivo
 * que todas mutan y que leen humanos. Un productor sin consumidor puede ser
 * correcto; lo que no puede es ser invisible.
 *
 * @returns {{ orphanRequires: string[], orphanProduces: string[],
 *   silentProducers: string[], silentConsumers: string[] }}
 */
export function auditHandoffs(root, chain = HANDOFFS) {
  const orphanRequires = []
  const silentProducers = []
  const silentConsumers = []
  const producedSoFar = new Set()
  const produced = new Set()
  const consumed = new Set()

  for (const step of chain) {
    let text = ''
    try {
      text = fs.readFileSync(path.join(root, step.prompt), 'utf8')
    } catch {
      orphanRequires.push(`${step.phase}: prompt no encontrado (${step.prompt})`)
      continue
    }

    for (const artifact of REQUIRED(step)) {
      if (!producedSoFar.has(artifact)) {
        orphanRequires.push(`${step.phase} requiere ${artifact}, que ninguna fase anterior produce`)
      }
      if (!mentions(text, artifact)) {
        silentConsumers.push(`${step.phase} declara requerir ${artifact} pero su prompt no lo nombra`)
      }
      consumed.add(artifact)
    }
    for (const artifact of PRODUCED(step)) {
      if (!mentions(text, artifact)) {
        silentProducers.push(`${step.phase} declara producir ${artifact} pero su prompt no lo nombra`)
      }
      producedSoFar.add(artifact)
      produced.add(artifact)
    }
  }

  const orphanProduces = [...produced]
    .filter((a) => !consumed.has(a))
    .map((a) => `${a} lo produce una fase y ninguna posterior lo pide`)

  return { orphanRequires, orphanProduces, silentProducers, silentConsumers }
}

/**
 * One line per phase, for the benchmark report.
 *
 * Usa las mismas listas expandidas que el auditor. Una versión anterior leía
 * `s.requires`/`s.produces` directo y por eso el reporte ocultaba los artefactos
 * condicionales: lo que el gate verificaba y lo que el humano leía no era lo
 * mismo, y el humano leía menos.
 *
 * Los condicionales se marcan con `(si aplica)` para que la diferencia entre una
 * dependencia dura y una que sólo cruza bajo condición sea visible en la línea y
 * no haya que ir a leer el fuente.
 */
export function formatHandoffChain(chain = HANDOFFS) {
  const label = (s) => {
    const hard = s.requires ?? []
    const cond = (s.conditionalRequires ?? []).map((a) => `${a} (si aplica)`)
    const all = [...hard, ...cond]
    return all.length ? all.join(', ') : '—'
  }
  const producedLabel = (s) => {
    const hard = s.produces ?? []
    const cond = (s.conditionalProduces ?? []).map((a) => `${a} (si aplica)`)
    const all = [...hard, ...cond]
    return all.length ? all.join(', ') : '—'
  }

  return chain
    .map((s) => {
      return `  ${s.phase.padEnd(17)} ← ${label(s).padEnd(52)} → ${producedLabel(s)}`
    })
    .join('\n')
}

function main() {
  const root = process.cwd()
  const r = auditHandoffs(root)

  console.log('=== AOI Phase Handoff Contract ===')
  console.log(formatHandoffChain())

  // Aviso, no fallo: un productor sin consumidor puede ser correcto (un
  // documento vivo que leen humanos). Lo que no puede es ser invisible.
  if (r.orphanProduces.length > 0) {
    console.log('')
    for (const w of r.orphanProduces) console.log(`⚠️  ${w}`)
  }

  const failures = [...r.orphanRequires, ...r.silentProducers, ...r.silentConsumers]
  if (failures.length > 0) {
    console.error('')
    for (const f of failures) console.error(`❌ ${f}`)
    console.error('\nUna cadena rota solo se nota a mitad del ciclo, con el trabajo previo ya gastado.')
    process.exit(1)
  }
  console.log('\n✅ Cada artefacto exigido lo produce una fase anterior, y ambos prompts lo nombran.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
