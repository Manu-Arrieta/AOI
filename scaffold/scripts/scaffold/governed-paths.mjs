/**
 * scripts/scaffold/governed-paths.mjs
 *
 * Responde una sola pregunta: ¿este archivo es código de AOI, o del Owner?
 *
 * Existe porque dos compuertas la respondían distinto y una de las dos estaba
 * mal. `validate-srp.mjs` decidía "gobernado" preguntando si existía
 * `scaffold/<rel>`, y eso era cierto hasta que el Owner zanjó el 2026-09-17 que
 * el andamio no se queda instalado: `setup.sh` borra `scaffold/` del destino.
 * Desde entonces, en TODA instalación el predicado era falso para cada archivo
 * y el ratchet del Invariante 5 auditaba cero archivos — imprimiendo igual
 * `✅ No new SRP violations`. Medido: 0 archivos contra un árbol con fuentes.
 *
 * Es la misma forma que ya se cobró en `validate-srp.mjs` con `MIRROR_DIR`:
 * una compuerta que no mira una ruta no reporta *no sé*, no reporta nada, y el
 * verde se lee como cobertura completa.
 *
 * La respuesta no puede depender de un directorio que se retira. Depende de la
 * lista declarada del espejo, que SÍ viaja a cada instalación dentro de
 * `scripts/scaffold/`.
 */

import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_SYNC_PATHS } from './sync-paths.mjs'

/**
 * True cuando `root` es el repositorio de desarrollo y no un workspace instalado.
 *
 * `setup.sh` en la raíz es la misma evidencia que usan `validate-test-globs.mjs`
 * y `undocumented-commands.mjs`. Allá todo `scripts/` es código de AOI.
 * @param {string} root
 */
export function isDevelopmentRepo(root) {
  return fs.existsSync(path.join(root, 'setup.sh'))
}

/**
 * True cuando la ruta cae bajo una ruta que AOI gobierna y envía en el scaffold.
 * @param {string} root raíz del árbol que se audita
 * @param {string} filePath absoluta o relativa a `root`
 */
export function isAoiGovernedPath(root, filePath) {
  const abs = path.resolve(root, filePath)
  return DEFAULT_SYNC_PATHS.some((entry) => {
    const governed = path.resolve(root, entry)
    return abs === governed || abs.startsWith(governed + path.sep)
  })
}
