/**
 * scripts/sdd-lifecycle/band-budget.mjs
 *
 * El presupuesto registrado de la banda universal, y las reglas que lo
 * comparan contra la banda derivada.
 *
 * Split de `cache-prefix.mjs` cuando ese archivo cruzó las 300 LOC del Invariante
 * 5 al agregar esta guarda. La costura es real y es la misma que separó
 * `sync-paths.mjs` de `validate-scaffold-parity.mjs`: acá vive un DATO (cuánto
 * pesa cada archivo hoy) y un ALGORITMO DE COMPARACIÓN; allá viven el mapa de
 * superficies y su particionado. Más de un módulo puede querer lo primero sin
 * lo segundo.
 *
 * Y la banda NO se define acá. `cache-prefix.mjs` la deriva con su predicado
 * —`multiplier === phaseCount`— y la pasa como argumento. Si el predicado
 * cambia, la compuerta y la medición no pueden discrepar porque hay una sola
 * derivación; este módulo sólo sostiene el valor contra el que se compara.
 */

/**
 * El presupuesto por archivo de la banda universal.
 *
 * Un token de la banda se recarga en TODAS las fases, así que un archivo que
 * crece cuesta siete veces. Nada lo notaba: `auditRepeatedMass` audita
 * VOLATILIDAD —que no haya un timestamp donde se paga siete veces— y nunca
 * compara un tamaño contra nada. `context-budget.mjs` diagnosticó el hueco en su
 * propio docstring (*"nothing failed when a prompt gained four hundred tokens"*)
 * pero no puede hospedar la guarda: está en el límite de 300 LOC.
 *
 * Lo que sí existía eran CUATRO caps sueltos en archivos de test, escritos tres
 * veces con la misma forma (`Math.round(text.length / 4)` + `assert.ok(tokens <=
 * N)`) y cubriendo dos de los ocho archivos: 4.544 de 9.457 tok/fase, el 48%.
 * Los otros 4.913 —34.391 por ciclo— no tenían ninguna guarda de tamaño.
 *
 * Y un cap no es un trinquete. `supervisor.agent.md` podía ir de 2.420 a 2.799
 * con las 26 compuertas en verde, o recortarse a 1.800 y volver a crecer 1.000
 * tokens: el cap seguía en 2.800 y el ahorro se evaporaba sin que nada lo
 * registrara. `validate-srp.mjs` ya documenta esa diferencia con `STALE BUDGET`.
 *
 * El baseline es el valor de hoy, como `LEGACY_BUDGET`: no premia el estado
 * actual, lo congela. Se derivó del instrumento, no se copió a mano.
 */
export const BAND_BUDGET = {
  '.github/agents/supervisor.agent.md': 1707,
  '.github/instructions/agent-delegation.instructions.md': 2031,
  '.github/instructions/icm-protocol.instructions.md': 2124,
  '.github/instructions/model-selection.instructions.md': 396,
  '.github/instructions/rtk.instructions.md': 334,
  '.github/skills/icm/SKILL.md': 414,
  '.github/skills/rtk/SKILL.md': 228,
  '.github/skills/sdd-lifecycle/SKILL.md': 1510,
}

/**
 * El techo total de la banda, ratcheteado igual.
 *
 * Bajó de 9.457 a 8.744 con el recorte de `supervisor.agent.md` (2.420 → 1.707):
 * 713 de los 1.195 tokens de su tabla de ruteo eran **espacios de alineación**.
 * El trinquete lo reclamó él mismo con `STALE BUDGET` antes de que se bajara acá,
 * que es exactamente el mecanismo: un ahorro que no se registra se puede volver a
 * gastar.
 */
export const BAND_CEILING = 8744

/**
 * Compara la banda derivada contra su baseline. Pura: sólo decide, no imprime.
 *
 * Las cinco reglas, y el modo de falla que cierra cada una:
 *
 *   1. **crece** → el crecimiento silencioso: +400 tok en un prompt son +2.800
 *      por ciclo para siempre, y las 26 compuertas seguían verdes.
 *   2. **encoge** → el ahorro que se evapora: sin esto un recorte no queda
 *      capturado y se puede volver a gastar. Es la razón de ser del trinquete.
 *   3. **entra** → el más caro: una instruction cuyo `applyTo` pasa a matchear
 *      `**` entra a la banda ×7 EN SILENCIO, y hoy ocurre sin que nada lo diga.
 *   4. **techo** → la evasión agregada: ocho archivos que bajan 10 tokens cada
 *      uno para que uno suba 200.
 *   5. **sale** → la entrada huérfana: un archivo del baseline que ya no se mide.
 *
 * @param {Array<{source: string, tokens: number, multiplier: number}>} universal
 * @param {object} [budget] baseline por archivo
 * @param {number} [ceiling] techo del total
 * @returns {string[]} hallazgos, vacío cuando la banda coincide con el baseline
 */
export function auditBandBudget(universal, budget = BAND_BUDGET, ceiling = BAND_CEILING) {
  const failures = []
  const seen = new Set()

  for (const r of universal) {
    seen.add(r.source)
    const allowed = budget[r.source]
    if (allowed === undefined) {
      failures.push(`NEW IN BAND  ${r.source} — ${r.tokens} tok; su superficie ahora se recarga en todas las fases`)
    } else if (r.tokens > allowed) {
      const delta = (r.tokens - allowed) * r.multiplier
      failures.push(`GREW  ${r.source} — ${r.tokens} tok, era ${allowed} (+${delta} por ciclo); la banda sólo puede encogerse`)
    } else if (r.tokens < allowed) {
      failures.push(`STALE BUDGET  ${r.source} bajó a ${r.tokens} — bajá el presupuesto en este commit`)
    }
  }

  for (const source of Object.keys(budget)) {
    if (!seen.has(source)) failures.push(`REMOVED FROM BAND  ${source} — quitá la entrada`)
  }

  const total = universal.reduce((n, r) => n + r.tokens, 0)
  if (total > ceiling) failures.push(`BAND CEILING  ${total} > ${ceiling}`)

  return failures
}
