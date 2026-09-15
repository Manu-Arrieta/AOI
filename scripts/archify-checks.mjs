/**
 * scripts/archify-checks.mjs
 *
 * Detección de la skill de Archify, separada de `doctor-checks.mjs`.
 *
 * Se extrajo cuando ese archivo llegó a 300 LOC para el validador de SRP: cero
 * headroom, o sea que la próxima línea que alguien agregara rompía la build, y
 * el borde lo había creado esta misma tanda de trabajo al sumar los chequeos de
 * Archify. El corte es un límite de verdad: "¿está la herramienta de diagramas?"
 * es una pregunta distinta de "¿están los binarios y la memoria?".
 *
 * `doctor-checks.mjs` re-exporta las dos funciones, así que ningún llamador tuvo
 * que enterarse del corte — mismo precedente que `test-reachability.mjs`.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Las rutas donde el CLI `skills` puede dejar el renderizador, relativas al
 * HOME, y en el orden de precedencia.
 *
 * Fuente única del lado JavaScript: `findArchifyRenderer` la recorre y los dos
 * tests la importan en vez de escribir su propia copia. Cuando la lista vivía
 * repetida, la copia del test no se enteraba de un cambio y seguía verde
 * midiendo una lista que ya no era la del código.
 *
 * Las cuatro existen porque el CLI cambia dónde deja el paquete según su
 * versión: plano o anidado (`archify/archify/bin`), y bajo la raíz de
 * Codex/Antigravity (`~/.agents`) o la de Claude Code (`~/.claude`).
 *
 * El lado shell no puede importar esto, así que `setup.sh`,
 * `install-archify.sh` e `install-archify.ps1` mantienen su copia a mano. Esa
 * copia NO se confía: `scripts/conf/archify-candidate-parity.test.mjs` compara
 * las tres contra esta lista y falla si alguna se desvía — que es exactamente
 * lo que pasó con `setup.sh`, donde faltaba la anidada de Claude Code.
 */
export const ARCHIFY_RENDERER_CANDIDATES = [
  '.agents/skills/archify/bin/archify.mjs',
  '.claude/skills/archify/bin/archify.mjs',
  '.agents/skills/archify/archify/bin/archify.mjs',
  '.claude/skills/archify/archify/bin/archify.mjs',
]

/**
 * Localiza el renderizador de Archify y devuelve su ruta, o `''` si no está.
 *
 * Fuente ÚNICA de la detección: la usan el doctor y la compuerta de blueprint.
 * Duplicar la lista de candidatos garantizaría que las dos respuestas divergan,
 * y el síntoma sería una compuerta que cree que Archify no está mientras el
 * doctor dice que sí.
 *
 * Las rutas son las raíces globales de skills de los harnesses de AOI: `codex`
 * resuelve a `~/.agents/skills` y `claude-code` a `~/.claude/skills`.
 *
 * @param {string} [homeDir]
 * @returns {string} Ruta absoluta al renderizador, o '' si no existe.
 */
export function findArchifyRenderer(homeDir = os.homedir()) {
  const candidates = ARCHIFY_RENDERER_CANDIDATES.map((rel) => path.join(homeDir, rel))
  return candidates.find((candidate) => fs.existsSync(candidate)) || ''
}

/**
 * Verifica la skill de Archify por la RUTA DEL RENDERIZADOR.
 *
 * No es un binario de PATH y no debe tratarse como uno: `which archify` no
 * encuentra nada aunque la skill esté perfectamente instalada, así que meterlo
 * en la lista de binarios produciría un falso negativo permanente. Lo que
 * importa es que el renderizador exista: es lo único que puede satisfacer la
 * obligación de diagrama de la Fase -2.
 *
 * Ausente es WARNING, no FAILED. Archify no ahorra tokens y no es un binario de
 * AOI: es una skill de terceros que se baja de upstream, así que su ausencia
 * degrada una compuerta opcional en vez de romper el sistema — el mismo trato
 * que Headroom, el otro caso declarado de dependencia no bloqueante.
 *
 * @param {string} [homeDir]
 * @returns {{ status: 'PASSED'|'WARNING', details: string }}
 */
export function checkArchifySkill(homeDir = os.homedir()) {
  const found = findArchifyRenderer(homeDir)
  if (found) return { status: 'PASSED', details: found }

  return {
    status: 'WARNING',
    details: 'renderer not found — la compuerta de diagrama de la Fase -2 queda inactiva (instalar: bash scripts/install-archify.sh --yes)',
  }
}
