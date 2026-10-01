/**
 * scripts/scaffold/nested-checkout.mjs
 *
 * Un directorio que contiene su propio `.git` —archivo o directorio— es OTRO
 * checkout, y lo que hay adentro no es parte del árbol que se está recorriendo.
 *
 * Medido el 2026-10-01: Claude Code crea sus worktrees DENTRO del repositorio,
 * en `.claude/worktrees/<nombre>/`, y cada uno es un checkout completo con un
 * `.git` archivo. Con diez presentes, `pnpm test` desde la raíz cayó en rojo:
 * `aoi:test-globs` reportó 1313 tests que ningún runner colecta, todos de esos
 * worktrees; `aoi:audit-protocol` encontró 11 copias del protocolo; y la
 * inyección de fallas copió los worktrees enteros a su sandbox. Trece
 * recorridos llevaban cada uno su propio conjunto de nombres a saltar y
 * ninguno reconocía un checkout anidado, porque el nombre no lo delata: lo
 * delata el `.git`. Por eso la regla es esa y no la ruta `.claude/worktrees`,
 * que es sólo donde una herramienta decidió ponerlos hoy.
 *
 * La raíz del recorrido nunca se consulta: un worktree tiene su `.git` en la
 * raíz y ES el árbol. Por eso los recorridos preguntan por cada hijo que van a
 * descender, no por el directorio donde empiezan.
 */

import fs from 'node:fs'
import path from 'node:path'

/** ¿`dir` es la raíz de un checkout aparte, que el recorrido no debe pisar? */
export function isNestedCheckout(dir) {
  return fs.existsSync(path.join(dir, '.git'))
}

/**
 * El `filter` de `fs.cpSync` que no copia checkouts anidados bajo `root`.
 * `rest` es el filtro propio del llamador, que sigue decidiendo lo demás.
 */
export function withoutNestedCheckouts(root, rest = () => true) {
  return (src) => src === root || (rest(src) && !isNestedCheckout(src))
}
