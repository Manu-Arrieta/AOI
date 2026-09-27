/**
 * scripts/sdd-lifecycle/blueprint-facts.mjs
 *
 * Los hechos `sbc.*` leídos y con forma. Puro: no sabe de ICM, de archivos ni de
 * veredictos — recibe filas `{ key, value }` y devuelve blueprints.
 *
 * POR QUÉ ESTÁ SEPARADO DE `blueprint-gate.mjs`, Y EL CORTE NO ES ARITMÉTICO.
 *
 * Ese archivo llegó a 336 LOC contra el Invariante 5 —ya estaba en 290, o sea al
 * borde, cuando el 2026-09-27 se le agregó la lectura de la sucesión entre
 * contratos—. Las dos salidas eran comprimir los comentarios hasta que entraran,
 * o cortar por donde el código ya estaba partido.
 *
 * **Comprimir los comentarios habría sido el defecto, no la solución**: la razón
 * de un bloque es lo que evita que el próximo deshaga la decisión, y borrarla para
 * que pase un contador deja el archivo más chico y peor. El repositorio ya tiene
 * escrito el criterio —`blueprint-diagram.mjs` existe porque este mismo archivo
 * tocó el límite antes, y su cabecera lo dice—, así que se aplica igual.
 *
 * Y la frontera es REAL, no una partición para entrar en el número:
 *
 * | Módulo | Responde |
 * | :--- | :--- |
 * | `blueprint-facts.mjs` | ¿qué dicen los hechos? |
 * | `blueprint-gate.mjs` | ¿el grafo que describen está cerrado? |
 * | `blueprint-diagram.mjs` | ¿qué artefacto se debe por él? |
 *
 * Leer y dar forma es una pregunta distinta de juzgar la estructura, que es
 * distinta de decidir la obligación derivada. Los tres se testean por separado y
 * ninguno necesita a los otros dos para responder lo suyo.
 *
 * `blueprint-gate.mjs` los re-exporta, así que los llamadores —y `genesis-phase.mjs`
 * con su fixture— no cambian: el corte es interno y no deberían enterarse de dónde
 * cayó.
 */

/** Fact key shapes written by /sdd-genesis on Genesis Gate approval. */
export const CONTEXTS_KEY_PATTERN = /^sbc\.([A-Za-z0-9_-]+)\.contexts$/
export const NEVER_KEY_PATTERN = /^sbc\.([A-Za-z0-9_-]+)\.never\.(\d+)$/
export const CROSSING_KEY_PATTERN = /^sbc\.([A-Za-z0-9_-]+)\.crossing\.(\d+)$/
export const TRACER_KEY_PATTERN = /^sbc\.([A-Za-z0-9_-]+)\.tracer$/

/**
 * La sucesión entre contratos: `sbc.<sucesor>.predecessor` nombra al anterior.
 *
 * Existe porque medido el 2026-09-27 la compuerta exigía los diagramas de un
 * contrato que otro había sucedido. La clave ya se escribía —`SBC-2026-002` tiene
 * la suya, y dice que expande al `001`— y la compuerta no la leía, así que veía
 * dos contratos vigentes en vez de uno vigente y un antecesor.
 */
export const PREDECESSOR_KEY_PATTERN = /^sbc\.([A-Za-z0-9_-]+)\.predecessor$/

/**
 * El id del SBC referenciado adentro del texto libre del hecho `predecessor`.
 *
 * El valor es prosa —"SBC-2026-001 — expandido, no reemplazado: hereda D1
 * completo..."—, así que se extrae el primer id con forma de SBC.
 *
 * **Un valor que no lo traiga no marca a nadie, y ésa es la dirección correcta del
 * fallo.** Una sucesión ilegible deja la obligación EN PIE en vez de dispensarla:
 * el error de más es un diagrama pedido de más —visible, y con la salida barata de
 * corregir el hecho—, y el de menos es deuda arquitectónica en silencio.
 */
export const SBC_ID_IN_VALUE = /SBC-\d{4}-\d{3}/

/** `Origen -> Destino: nombre del flujo` — el formato que fija el prompt. */
export function parseCrossingValue(value = '') {
  const text = String(value).trim()
  const split = text.split('->')
  if (split.length < 2) return null

  const from = split[0].trim()
  const rest = split.slice(1).join('->').trim()
  const colon = rest.indexOf(':')
  const to = (colon === -1 ? rest : rest.slice(0, colon)).trim()
  const flow = colon === -1 ? '' : rest.slice(colon + 1).trim()

  if (!from || !to) return null
  return { from, to, flow }
}

/** Agrupa los hechos `sbc.*` por blueprint. Un workspace puede tener varios. */
export function collectBlueprints(facts = []) {
  const byId = new Map()
  const entry = (id) => {
    if (!byId.has(id)) {
      byId.set(id, { sbcId: id, contexts: [], globals: [], crossings: [], tracer: '', supersededBy: '' })
    }
    return byId.get(id)
  }

  // predecesor -> sucesor, para aplicar al final y sólo sobre los que existen.
  const sucesorDe = new Map()

  for (const fact of facts) {
    if (!fact || typeof fact.key !== 'string') continue
    const value = String(fact.value ?? '').trim()

    let m = fact.key.match(CONTEXTS_KEY_PATTERN)
    if (m) {
      entry(m[1]).contexts = value.split(',').map((s) => s.trim()).filter(Boolean)
      continue
    }
    m = fact.key.match(NEVER_KEY_PATTERN)
    if (m) {
      entry(m[1]).globals.push({ tag: `${m[1]}:never.${m[2]}`, statement: value })
      continue
    }
    m = fact.key.match(CROSSING_KEY_PATTERN)
    if (m) {
      entry(m[1]).crossings.push({ tag: `${m[1]}:crossing.${m[2]}`, raw: value, parsed: parseCrossingValue(value) })
      continue
    }
    m = fact.key.match(PREDECESSOR_KEY_PATTERN)
    if (m) {
      const predecesor = value.match(SBC_ID_IN_VALUE)?.[0]
      // Un contrato que se nombra a sí mismo como su propio predecesor no sucede a
      // nadie: sin esta guarda se dispensaría de sus propios diagramas escribiendo
      // una línea, que es la salida gratis que hace inútil la obligación.
      if (predecesor && predecesor !== m[1]) sucesorDe.set(predecesor, m[1])
      continue
    }
    m = fact.key.match(TRACER_KEY_PATTERN)
    if (m) entry(m[1]).tracer = value
  }

  // Se aplica DESPUÉS y sobre los que ya existen: si el sucesor nombra a un SBC del
  // que no hay ningún hecho, `entry()` crearía un contrato fantasma con cero cruces,
  // y el reporte lo mostraría como un blueprint vacío en vez de como la referencia
  // rota que es.
  for (const [predecesor, sucesor] of sucesorDe) {
    const sucedido = byId.get(predecesor)
    if (sucedido) sucedido.supersededBy = sucesor
  }

  return [...byId.values()].sort((a, b) => a.sbcId.localeCompare(b.sbcId))
}
