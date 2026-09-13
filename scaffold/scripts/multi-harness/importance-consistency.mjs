#!/usr/bin/env node
/**
 * scripts/multi-harness/importance-consistency.mjs
 *
 * Cruza los niveles de `importance` que la prosa escribe contra la tabla del
 * protocolo ICM. Nada más.
 *
 * Por qué existe, y es una recurrencia. `protocol-source.mjs` documenta en su
 * propio encabezado el defecto que lo originó: *"the generated CLAUDE.md told
 * agents to file an architecture decision as `high` while the protocol said
 * `critical`. Both surfaces are always in context, so an agent read that
 * contradiction on every single task, and no gate could see it"*. Ese arreglo se
 * aplicó a los archivos de harness —CLAUDE.md, AGENTS.md y compañía— y **no a los
 * agentes**: la contradicción se mudó en vez de morir.
 *
 * La encontró una sonda conductual, no una compuerta. Un modelo leyó el contexto
 * de la Fase 3 y contestó `high` para una decisión de arquitectura, citando
 * `devops-engineer.agent.md` como respaldo. Tenía razón sobre lo que el repo dice
 * —y el repo se contradice con su propio protocolo—. Ese es el valor de la capa
 * conductual: ve lo que la estructural no puede, porque ninguna compuerta
 * preguntaba *"¿el agente decide bien con lo que queda?"*.
 *
 * Qué verifica: una llamada a `icm_memory_store` cuyo texto describe una
 * **decisión** —de arquitectura, de diseño, de infraestructura, de base de datos—
 * tiene que usar `critical`, que es lo que el protocolo le asigna. `high` es para
 * lo que el protocolo enumera: spec o plan producido, tarea completada, reporte
 * de QA, error resuelto.
 *
 * 0 tokens de inferencia: se lee la tabla del protocolo y se compara texto.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/** La fuente canónica del nivel de cada caso. */
export const ICM_PROTOCOL = '.github/instructions/icm-protocol.instructions.md'

/**
 * Superficies donde un `importance` mal puesto desvía a un agente.
 *
 * La prosa es EJECUTABLE: un agente lee su archivo de agente y las instructions
 * en el mismo contexto, así que una contradicción se lee en cada tarea.
 */
export const SURFACES = ['.github/agents', '.github/prompts', '.github/instructions', '.github/skills']

/**
 * Palabras que marcan un store como "esto guarda una DECISIÓN DE ARQUITECTURA".
 *
 * El protocolo asigna `critical` a *"project stack o contexto · decisión de
 * arquitectura · convención establecida · preferencia del Owner"*. La lista
 * enumerada es la del protocolo, **y no incluye la palabra "decisión" a secas** —
 * y esa precisión es deliberada, no un olvido.
 *
 * La primera versión incluía `decision|decisión`, y con eso marcaba
 * `ux-designer` *"Store design decisions"*. Una decisión de **diseño** de un
 * componente no es una decisión de **arquitectura**: el protocolo no la enumera
 * como `critical`, y `high` —"spec o plan producido"— le queda razonable. Marcarla
 * habría sido over-claiming: subir a `critical` algo que el protocolo no pide, y
 * con eso volver ruidosa la compuerta que existe para que se le haga caso.
 *
 * `infra` sí entra: una decisión de infraestructura durante una tarea cambia la
 * arquitectura del despliegue, y el propio agente la persiste en el memoir
 * `{WORKSPACE}-architecture`.
 */
export const DECISION_WORDS =
  /\b(architecture|arquitectura|stack|convention|convenci[oó]n|infra|infrastructure|infraestructura)\b/i

/**
 * El nivel que el protocolo le asigna a una decisión, LEÍDO del protocolo.
 *
 * Lo tenía hardcodeado como `'critical'`, y el encabezado de este archivo
 * afirmaba que la tabla salía del protocolo. Una verificación adversarial lo
 * encontró: el nivel no se derivaba de ningún lado, y con el protocolo invertido
 * la compuerta seguía exigiendo `critical` — habría marcado como error exactamente
 * lo que el protocolo pedía.
 *
 * Se deriva buscando, en la tabla de niveles, cuál mapea a los casos de decisión
 * que este archivo reconoce. Si el protocolo cambia de criterio, la compuerta
 * cambia con él; si no se puede leer, cae al valor que el protocolo tiene hoy, y
 * eso es un default explícito y no una verdad escondida.
 */
export function decisionLevelFromProtocol(root) {
  try {
    const text = fs.readFileSync(path.join(root, ICM_PROTOCOL), 'utf8')
    for (const m of text.matchAll(/`(critical|high|medium|low)`\s*→\s*([^\n]+)/g)) {
      if (DECISION_WORDS.test(m[2])) return m[1]
    }
  } catch {
    // Sin protocolo legible: se sigue verificando con el criterio vigente, y el
    // veredicto lo dice en vez de fingir que citó una tabla.
  }
  return 'critical'
}

/** Nivel que el protocolo asigna a lo que NO es decisión (progreso, entregable). */
export const PROGRESS_LEVELS = new Set(['high', 'medium'])

/**
 * Los niveles aparecen en DOS sintaxis, y la primera versión sólo veía una.
 *
 *   `importance: "high"`                      (MCP, la forma que usan los agentes)
 *   `icm store -t "..." -c "..." -i high`     (CLI, la que documenta el protocolo)
 *
 * `.github/instructions/icm-protocol.instructions.md` define la forma CLI como el
 * fallback canónico, así que una compuerta que no la lee no puede vigilar su
 * propia fuente. Lo encontró la verificación adversarial.
 */
const IMPORTANCE = /(?:importance:\s*"?(critical|high|medium|low)"?|\s-i\s+(critical|high|medium|low)\b)/g

/** La ventana donde se busca el rótulo, en caracteres hacia atrás. */
const WINDOW = 1500

/** Todo archivo bajo `target`, sea archivo suelto o directorio. */
export function filesUnder(target) {
  if (!fs.existsSync(target)) return []
  if (fs.statSync(target).isFile()) return [target]
  const out = []
  for (const e of fs.readdirSync(target, { withFileTypes: true })) {
    const p = path.join(target, e.name)
    out.push(...(e.isDirectory() ? filesUnder(p) : [p]))
  }
  return out
}

/**
 * El rótulo que precede a la llamada, en sus DOS formas.
 *
 * El rótulo aparece de dos maneras en la prosa, y la primera versión de este
 * patrón sólo veía una: `**Store** infra decisions:` lo pone afuera de la
 * negrita, y `**Persist architecture**:` lo pone adentro. Con un solo patrón,
 * `solution-architect.agent.md` se escapaba — un falso NEGATIVO, que en una
 * compuerta es peor que un falso positivo.
 */
const LABEL_PATTERNS = [
  /\*\*(?:Store|Persist)\*\*\s*([^:`]{0,60})/g,
  /\*\*(?:Store|Persist)\s+([^:*]{0,60})\*\*/g,
]

/** El último rótulo que aparece en un texto, o `''`. */
function lastLabel(before) {
  let best = { index: -1, label: '' }
  for (const pattern of LABEL_PATTERNS) {
    for (const m of before.matchAll(new RegExp(pattern.source, pattern.flags))) {
      const label = (m[1] || '').trim()
      if (label && m.index > best.index) best = { index: m.index, label }
    }
  }
  return best.label
}

/**
 * Detecta stores cuyo RÓTULO declara una decisión con un nivel distinto de
 * `critical`.
 *
 * @returns {Array<{ file: string, line: number, level: string, label: string }>}
 */
export function findMismatches(root, surfaces = SURFACES) {
  const out = []
  const DECISION_LEVEL = decisionLevelFromProtocol(root)
  for (const surface of surfaces) {
    for (const file of filesUnder(path.join(root, surface))) {
      if (!file.endsWith('.md')) continue
      const text = fs.readFileSync(file, 'utf8')
      const rel = path.relative(root, file)

      for (const m of text.matchAll(IMPORTANCE)) {
        const level = m[1] || m[2]
        if (level === DECISION_LEVEL) continue
        const window = text.slice(Math.max(0, m.index - WINDOW), m.index + m[0].length)
        // Las DOS formas de llamada, no una: `icm_memory_store(...)` es la MCP y
        // `icm store -t ...` la CLI. Buscar sólo la primera hacía invisible la
        // forma que el propio protocolo documenta como fallback.
        const callStart = Math.max(
          window.lastIndexOf('icm_memory_store'),
          window.lastIndexOf('icm store')
        )
        if (callStart === -1) continue

        const label = lastLabel(window.slice(0, callStart))
        if (!DECISION_WORDS.test(label)) continue

        out.push({ file: rel, line: text.slice(0, m.index).split('\n').length, level, label })
      }
    }
  }
  return out.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
}

/** Los casos que el protocolo asocia al nivel de decisión, para poder citarlos. */
export function protocolCases(root) {
  try {
    const text = fs.readFileSync(path.join(root, ICM_PROTOCOL), 'utf8')
    const level = decisionLevelFromProtocol(root)
    const m = new RegExp('`' + level + '`\\s*→\\s*([^\\n]+)').exec(text)
    return m ? m[1].trim() : ''
  } catch {
    return ''
  }
}

/** Reporte legible. Devuelve el código de salida. */
export function formatVerdict(root, mismatches = findMismatches(root)) {
  const DECISION_LEVEL = decisionLevelFromProtocol(root)
  const protocolSays = protocolCases(root)
  const lines = ['=== Consistencia de `importance` contra el protocolo ICM ===']
  if (protocolSays) lines.push(`  El protocolo asigna \`critical\` a: ${protocolSays}`)

  if (mismatches.length === 0) {
    lines.push(`\n✅ Ningún store de decisiones usa un nivel distinto de \`${DECISION_LEVEL}\`.`)
    return { text: lines.join('\n'), code: 0 }
  }

  lines.push(`\n❌ ${mismatches.length} store(s) describen una DECISIÓN con otro nivel:`)
  for (const m of mismatches) {
    lines.push(`   · ${m.file}:${m.line} — rótulo "${m.label}" usa "${m.level}"`)
  }
  lines.push(
    '',
    'Un agente lee su archivo y las instructions en el MISMO contexto, así que',
    'esta contradicción se lee en cada tarea. Un store de progreso o de entregable',
    'con `high` está bien; uno que guarda una decisión, no.'
  )
  return { text: lines.join('\n'), code: 1 }
}

/* c8 ignore start -- envoltura de CLI */
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const { text, code } = formatVerdict(REPO)
  process.stdout.write(text + '\n')
  process.exit(code)
}
/* c8 ignore stop */
