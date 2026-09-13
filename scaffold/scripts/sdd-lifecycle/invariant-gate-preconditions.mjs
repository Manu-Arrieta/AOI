/**
 * scripts/sdd-lifecycle/invariant-gate-preconditions.mjs
 *
 * Consigue un contrato LEGIBLE o bloquea. Nada más: no audita, no decide
 * cobertura, no formatea.
 *
 * Split de `invariant-gate.mjs` cuando ese archivo cruzó las 300 LOC del
 * Invariante 5 al sumar la guardia de alcanzabilidad. El corte es real:
 * **conseguir el contrato** y **cruzarlo contra la suite** son dos trabajos, y el
 * segundo no necesita saber de dónde vinieron las reglas.
 *
 * Acá viven las guardias de "¿leí algo?", que son la respuesta a seis caminos de
 * fail-open que una verificación adversarial encontró ejecutando el gate contra
 * entradas raras. La forma del defecto era siempre la misma: **una guardia escrita
 * dentro de una rama protege esa rama y ninguna otra**, y un `continue` silencioso
 * en un parser convierte *"no pude leerlo"* en *"no hay nada"*.
 *
 * La pregunta que las cierra no es *"¿el toolchain contestó?"* sino **"¿mi parser
 * extrajo al menos una regla?"**. Se responde una sola vez, después de parsear, y
 * vale para los tres caminos de entrada.
 */

import fs from 'node:fs'
import process from 'node:process'
import { extractContractRules, noFacts, parseFactTable, readFactsFromIcm } from './contract-facts.mjs'
import { resolveWorkspaceEntity } from './workspace-identity.mjs'

/**
 * Reads an entity's fact table, blocking with exit 2 when the ICM toolchain
 * cannot answer. Never pass silently on a broken toolchain: absence of evidence
 * is not evidence of compliance. A distinct exit code because "could not read
 * the contract" and "read it and it failed" need different fixes.
 */
function readEntityFacts(entity) {
  const read = readFactsFromIcm(entity)
  if (!read.ok) {
    // Las DOS salidas tienen que estar nombradas en las dos formas de bloqueo.
    // Antes este mensaje sólo ofrecía `--facts-file`, y el de la entidad
    // inferida sólo `--entity`: un test que exigía "dice cómo desbloquearse"
    // pasaba en el repositorio y fallaba en la instalación, donde la inferencia
    // cae en otra rama. El mensaje tiene que ser útil sin importar por cuál de
    // los dos caminos se llegó.
    process.stderr.write(
      `Invariant Gate BLOCKED: cannot read BIC facts for "${entity}" because ${read.reason}.\n` +
        'Fix the ICM toolchain, confirm the entity with --entity <WORKSPACE>, ' +
        'or pass --facts-file to audit from a captured table.\n'
    )
    process.exit(2)
  }
  return read.text
}

/**
 * Adquiere la tabla de hechos y devuelve las reglas a auditar, o bloquea.
 *
 * @param {{ factsFile: string, entity: string, bicFilter: string }} opts
 * @returns {{ rules: Array, allRules: Array }}
 */
export function acquireRules({ factsFile, entity, bicFilter }) {
  let factTable = ''
  let inferredEntity = ''

    if (factsFile) {
      if (!fs.existsSync(factsFile)) {
        process.stderr.write(`Invariant Gate BLOCKED: --facts-file not found: ${factsFile}\n`)
        process.exit(2)
      }
      factTable = fs.readFileSync(factsFile, 'utf8')
    } else if (entity) {
      factTable = readEntityFacts(entity)
    } else {
      // Ni --entity ni --facts-file: la invocación desnuda. Resuelve sola en vez
      // de morir por uso, pero ANUNCIA qué entidad eligió y con qué criterio.
      const resolved = resolveWorkspaceEntity(process.cwd())
      process.stderr.write(resolved.notice)
      factTable = readEntityFacts(resolved.entity)
      inferredEntity = resolved.entity
    }

    // ── La guardia de "¿leí algo?", y por qué vive acá y no en una rama ───────
    //
    // Estaba sólo en la rama de la entidad INFERIDA, y eso dejaba tres pases
    // silenciosos que una verificación adversarial encontró ejecutando el gate:
    //
    //   1. `--facts-file` con texto que `parseFactTable` no entiende (separado por
    //      tabs, en formato `key: value`, truncado): todos sus `continue` son
    //      silenciosos, así que *no pude parsear* se reportaba como *no hay
    //      contrato* → SKIPPED, exit 0.
    //   2. `--bic TYPO`: el contrato SÍ tenía hechos, el filtro no matcheó ninguno,
    //      y el gate decía "No BIC contract facts found for this workspace". Un
    //      mensaje falso y un exit 0.
    //   3. Peor: la guardia se evaluaba sobre el conjunto SIN filtrar, así que
    //      agregar `--bic <typo>` **desactivaba la única comprobación de que había
    //      leído algo**. Bastaba un argumento de más para apagar el fail-closed.
    //
    // La pregunta correcta nunca fue "¿el toolchain contestó?" sino **"¿mi parser
    // extrajo al menos una regla?"**. Se responde una sola vez, después de parsear,
    // y vale para los tres caminos de entrada.
    const parsedRows = parseFactTable(factTable)
    const allRules = extractContractRules(parsedRows)
    const rules = bicFilter ? allRules.filter((r) => r.bicId === bicFilter) : allRules

    // Un `--facts-file` que no produce NINGUNA fila es una captura rota: alguien
    // apuntó el gate a un archivo y el archivo no tenía nada legible. Y si el texto
    // vino de ICM en un formato inesperado, es lo mismo: el parser espera columnas
    // separadas por DOS O MÁS espacios, y todos sus `continue` son silenciosos.
    //
    // Los dos casos se leían como *no hay contrato* y salían 0. La distinción que
    // se recupera acá es la que importa: **no es lo mismo no tener contrato que no
    // poder leerlo**. El marcador de "ICM contestó que no hay hechos" lo posee
    // `contract-facts.mjs`; acá sólo se lo consulta.
    const deArchivo = Boolean(factsFile) && parsedRows.length === 0
    const ilegible = !deArchivo && factTable.trim() !== '' && parsedRows.length === 0 && !noFacts(factTable)
    if (deArchivo || ilegible) {
      process.stderr.write(
        `Invariant Gate BLOCKED: ${deArchivo ? `--facts-file "${factsFile}" no produjo ninguna fila legible.` : 'la tabla de hechos llegó con texto pero no se le pudo extraer ninguna fila.'}\n` +
          'Revisá la captura, o pasá --entity si querés consultar ICM en vivo.\n'
      )
      process.exit(2)
    }

    if (allRules.length > 0 && rules.length === 0) {
      process.stderr.write(
        `Invariant Gate BLOCKED: --bic "${bicFilter}" no coincide con ninguna regla del contrato, que tiene ${allRules.length}.\n` +
          `Reglas disponibles: ${allRules.map((r) => r.bicId).join(', ')}\n`
      )
      process.exit(2)
    }

    if (allRules.length === 0 && inferredEntity) {
      // Una entidad INFERIDA sin contrato no puede distinguir "la tarea nunca pasó
      // por /sdd-frame" de "adiviné el nombre equivocado". `SKIPPED` asume lo
      // primero y sale 0; con un nombre adivinado eso es un pase silencioso. Con
      // `--entity` explícito sí vale el `SKIPPED` documentado: alguien afirmó el
      // nombre.
      process.stderr.write(
        `Invariant Gate BLOCKED: la entidad inferida "${inferredEntity}" no tiene hechos bic.*.\n` +
          `Si "${inferredEntity}" es la correcta y la tarea no pasó por /sdd-frame, confirmala con --entity.\n`
      )
      process.exit(2)
    }

  return { rules, allRules }
}
