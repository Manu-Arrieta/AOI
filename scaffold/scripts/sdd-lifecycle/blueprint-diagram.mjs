/**
 * scripts/sdd-lifecycle/blueprint-diagram.mjs
 *
 * La obligación de diagrama de la Fase -2, y su auditoría.
 *
 * POR QUÉ ES BLANDO Y NO DURO
 *
 * La tentación es fail-closed: "declaraste cruces, así que producí diagramas, y
 * si no tenés la herramienta, fallá". Eso es peor que inútil. Quien dispara la
 * obligación son los cruces que el humano DECLARÓ, así que un desarrollador
 * bloqueado tiene dos salidas: instalar Archify, o **borrar el cruce**. La
 * segunda es gratis e instantánea.
 *
 * Y borrar el cruce es exactamente el daño que la Fase -2 existe para impedir.
 * El prompt lo dice: un cruce sin flujo es una integración no escrita. Una
 * compuerta que se satisface borrando aquello que custodia enseña a esconder
 * integraciones.
 *
 * El criterio que sale de ahí: **bloquear sólo cuando la condición de bloqueo se
 * remueve trivialmente haciendo lo correcto.** Con Archify instalado, producir
 * el diagrama son minutos y el camino correcto es el barato. Sin Archify, el
 * camino correcto es una instalación y el incorrecto es una tecla. Ahí no se
 * bloquea — se reporta fuerte.
 *
 * Lo que sí queda duro, y no depende de Archify en absoluto, es la obligación
 * arquitectónica: todo cruce con flujo nombrado. Eso lo enforcea la aserción 3
 * de `auditBlueprintClosure`, con hechos O(1). El diagrama es el artefacto
 * derivado; la prosa es la fuente de verdad.
 *
 * Split de `blueprint-gate.mjs` para no cruzar el Invariante 5, y con un límite
 * real: decidir QUÉ se debe es una pregunta distinta de auditar si el grafo está
 * cerrado.
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { parseFactTable } from './contract-facts.mjs'

/** Dónde vive el blueprint y sus diagramas dentro del WORKSPACE, según el prompt. */
export const BLUEPRINT_DIR = '.blueprints'

/**
 * Decide si un blueprint debe diagramas, y si la obligación puede exigirse.
 *
 * Los tres estados NO son cosméticos. `not-required` dice que la obligación no
 * aplica; `unmet` dice que existe y no se cumplió. Un reporte que imprima lo
 * mismo en los dos casos convierte deuda arquitectónica en silencio.
 *
 * @param {{ crossings?: Array<unknown>, sbcId?: string }} blueprint
 * @param {{ archifyAvailable?: boolean }} [options]
 * @returns {{ status: 'not-required'|'required'|'unmet', enforce: boolean,
 *   crossings: number, reason: string }}
 */
export function diagramObligation(blueprint, { archifyAvailable = true } = {}) {
  const crossings = blueprint?.crossings?.length ?? 0
  const sbcId = blueprint?.sbcId ?? '(sin id)'

  if (crossings === 0) {
    return {
      status: 'not-required',
      enforce: false,
      crossings: 0,
      reason: 'cero cruces de frontera: no hay integración que diagramar',
    }
  }

  const plural = `${crossings} cruce(s) de frontera`

  if (!archifyAvailable) {
    return {
      status: 'unmet',
      enforce: false,
      crossings,
      reason: `${plural} exigen diagrama sequence, y Archify no está instalado — obligación REGISTRADA, no cumplida`,
    }
  }

  return {
    status: 'required',
    enforce: true,
    crossings,
    reason: `${plural} exigen diagrama sequence validado (Archify disponible)`,
  }
}

/**
 * Audita los artefactos de diagrama de un blueprint en el WORKSPACE.
 *
 * El gate corre en el repo y lee hechos de ICM; el blueprint vive en el
 * workspace. Sin un workspace explícito no hay nada que auditar — y por eso la
 * ausencia de `--workspace` no puede leerse como cumplimiento.
 *
 * @param {string} workspaceRoot
 * @param {string} sbcId
 * @returns {{ present: boolean, dir: string, files: string[] }}
 */
export function auditDiagramArtifacts(workspaceRoot, sbcId) {
  const dir = path.join(workspaceRoot, BLUEPRINT_DIR, sbcId, 'diagrams')
  if (!workspaceRoot || !fs.existsSync(dir)) return { present: false, dir, files: [] }

  const files = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile())
    // El entregable es el HTML; el JSON-IR es la fuente intermedia. Cuenta
    // cualquiera de los dos porque un IR sin render sigue siendo trabajo hecho,
    // y reportar "cero diagramas" sobre un IR presente sería falso.
    .filter((e) => /\.(html|json)$/i.test(e.name))
    .map((e) => e.name)

  return { present: files.length > 0, dir, files }
}

/**
 * Parsea los argumentos del CLI de la compuerta.
 *
 * Existe porque la versión anterior filtraba por `startsWith('--')`, lo que
 * dejaba el VALOR de un flag como si fuera el nombre de la entidad: con
 * `--workspace /tmp/ws`, `/tmp/ws` se leía como el workspace de ICM. Los flags
 * con valor se consumen de a dos.
 *
 * Un flag DESCONOCIDO es un error, no ruido. Ignorarlo en silencio convierte un
 * typo (`--workspac /ruta`) en una corrida que reporta "sin workspace" — y sin
 * workspace la compuerta no puede afirmar cumplimiento, así que el typo degrada
 * a un reporte que se lee como si no hubiera nada pendiente. Falla fuerte y dice
 * cuál.
 *
 * `--db` no es cosmético: es la única forma de ejercitar la compuerta contra una
 * base descartable. Sin él, probarla obliga a escribir hechos en el store
 * COMPARTIDO de ICM, que es mutable y que otros proyectos leen — el e2e contamina
 * datos ajenos. `ICM_DB` no alcanza: no lo honra este build.
 *
 * @param {string[]} argv
 * @returns {{ positional: string[], workspaceRoot: string, dbPath: string, record: boolean }}
 */
export function parseGateArgs(argv = []) {
  const flags = { '--workspace': '', '--db': '' }
  const KNOWN_BOOLEAN = new Set(['--record'])
  const positional = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg in flags) {
      flags[arg] = argv[++i] || ''
      continue
    }
    if (KNOWN_BOOLEAN.has(arg)) continue
    if (arg.startsWith('--')) {
      throw new Error(
        `flag desconocido: ${arg} (conocidos: ${[...Object.keys(flags), ...KNOWN_BOOLEAN].join(', ')})`,
      )
    }
    positional.push(arg)
  }

  return {
    positional,
    workspaceRoot: flags['--workspace'],
    dbPath: flags['--db'],
    record: argv.includes('--record'),
  }
}

/** Formatea el veredicto de la obligación para el reporte. */export function formatDiagramObligation(sbcId, obligation, artifacts = null) {
  const icon = { 'not-required': '⏭️', required: '📐', unmet: '⚠️' }[obligation.status]
  const lines = [`\n### Diagrama (${sbcId}): ${icon} ${obligation.status.toUpperCase()}`, '', obligation.reason]

  if (artifacts) {
    lines.push(
      '',
      artifacts.present
        ? `Artefactos: ${artifacts.files.length} en \`${artifacts.dir}\` (${artifacts.files.join(', ')})`
        : `Artefactos: NINGUNO en \`${artifacts.dir}\``,
    )
  }

  if (obligation.status === 'unmet') {
    lines.push(
      '',
      '> La obligación arquitectónica NO se relaja por esto: todo cruce sigue exigiendo su flujo',
      '> nombrado, y eso se enforcea con hechos O(1). Lo que queda pendiente es el artefacto derivado.',
      '> Habilitalo con: `bash scripts/install-archify.sh --yes`',
    )
  }

  return lines.join('\n')
}

/**
 * Lee los hechos `sbc.*` de la entidad, o `[]` si ICM no responde.
 *
 * Vive acá junto a `recordObligation` porque las dos son E/S de ICM: leer el
 * blueprint y registrar su estado son la misma pregunta dicha en dos sentidos,
 * y separarlas fue lo que dejó al gate en 305 LOC contra el límite de 300.
 *
 * @param {string} entity
 * @param {string} [dbPath] Base descartable, para no tocar el store compartido.
 * @returns {Array<{ key: string, value: string }>}
 */
export function readSbcFacts(entity, dbPath = '') {
  const args = ['facts', 'list', entity, '-p', 'sbc.', '--read-only']
  if (dbPath) args.push('--db', dbPath)
  try {
    const text = execFileSync('icm', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return parseFactTable(text)
  } catch {
    return []
  }
}

/**
 * Persiste el estado de la obligación para que la deuda sea auditable.
 *
 * Una obligación que sólo se imprime se disuelve en el scroll: nadie sabe que
 * quedó pendiente. `/sdd-verify` la lee de acá.
 *
 * Devuelve la línea a mostrar en vez de imprimirla: quién habla con el operador
 * es el CLI, y un módulo que escribe en stdout por su cuenta deja de ser
 * probable.
 *
 * @returns {string} Línea de resultado, ya sea de éxito o de fallo.
 */
export function recordObligation(entity, sbcId, obligation, dbPath = '') {
  const key = `sbc.${sbcId}.diagram-obligation`
  const args = ['facts', 'set', entity, key, obligation.status]
  if (dbPath) args.push('--db', dbPath)
  try {
    execFileSync('icm', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return `  ↳ registrado: ${key} = ${obligation.status}`
  } catch {
    return `  ↳ no pude registrar ${key} (ICM no respondió)`
  }
}
