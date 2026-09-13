/**
 * scripts/memory-sync/library-only.mjs
 *
 * Guardia para los módulos de `memory-sync` que NO son ejecutables.
 *
 * Por qué existe, y es un defecto medido. Una lente adversarial corrió
 * `node scripts/memory-sync/rollback-version.mjs ws target-v1` y **salió 0 sin
 * imprimir nada y sin hacer nada**: el archivo exporta una función y no tiene
 * runner, así que Node lo carga, no ejecuta nada y termina bien. Y el
 * `icm-protocol` le dice al agente que mutar `active.json` pasa *"ONLY via
 * managed lifecycle scripts in `scripts/memory-sync/`"*. Un agente que siga esa
 * instrucción cree que el rollback ocurrió.
 *
 * Ése es el peor final posible para un comando de mutación: **éxito silencioso
 * sin efecto**. Es la misma familia que el `continue` silencioso de un parser y
 * que el `||` del protocolo que re-ejecuta una compuerta —una guardia que no
 * existe—, sólo que acá el que se equivoca es el operador y el instrumento lo
 * deja creer que salió bien.
 *
 * No se les agrega un CLI en esta pasada: eso es superficie NUEVA de mutación,
 * con sus propios guards de argumentos, y merece su ciclo. Lo que se hace acá es
 * que el error sea ruidoso, que es lo mínimo indispensable.
 */

import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/**
 * Aborta si el módulo se está ejecutando directamente en vez de importándose.
 *
 * @param {string} importMetaUrl `import.meta.url` del módulo que llama
 * @param {string} usage Cómo se supone que se usa, en una línea
 */
export function refuseDirectExecution(importMetaUrl, usage) {
  const invoked = process.argv[1]
  if (!invoked) return
  if (path.resolve(invoked) !== fileURLToPath(importMetaUrl)) return

  process.stderr.write(
    'Este módulo es la API del ciclo de vida de memory-sync, no un ejecutable.\n' +
      'Invocarlo con `node` no hace nada, y antes salía 0: un éxito silencioso\n' +
      'sin efecto sobre un comando de mutación.\n\n' +
      `Importalo desde un script propio:\n  ${usage}\n`,
  )
  process.exit(1)
}
