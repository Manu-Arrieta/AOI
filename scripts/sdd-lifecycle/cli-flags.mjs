/**
 * scripts/sdd-lifecycle/cli-flags.mjs
 *
 * Flags estrictos para los CLIs de AOI: un flag desconocido, un flag sin valor,
 * un argumento suelto o un valor fuera de su enumeración salen con exit 2 y
 * nombran lo que sí se acepta.
 *
 * Por qué existe, y es un defecto medido (auditoría 2026-09-30, D3–D6). Cada
 * CLI tenía su propio bucle sobre `argv` que IGNORABA lo que no reconocía, así
 * que un typo en la prosa cambiaba el comportamiento sin que nada lo dijera.
 * Medido, todo con exit 0: `--hub` y `--summry` devolvían la salida COMPLETA
 * de los lentes (38.247 y 32.243 bytes) en vez del resumen (465 y 109),
 * `--format yaml` devolvía markdown, `--harness claud` compilaba 0 archivos,
 * `sdd-stress-suite --help` corría la suite entera (14.303 bytes). Y leído en
 * el código: `--reset --sett all=#1` borraba la asignación de modelos entera e
 * imprimía ✅. Un solo parser —`util.parseArgs` en modo estricto— en vez de N
 * bucles que divergen.
 *
 * Vive en `sdd-lifecycle/` y no en la raíz de `scripts/`: la raíz no está en
 * `DEFAULT_SYNC_PATHS`, así que un helper ahí no viajaba a la instalación y
 * cada CLI que lo importara rompía con ERR_MODULE_NOT_FOUND en el workspace.
 */

import { parseArgs } from 'node:util'

/** Un error del operador, no del programa: el CLI lo convierte en exit 2. */
export class UsageError extends Error {}

function describeFlag([name, o]) {
  const short = o.short ? '|-' + o.short : ''
  return `--${name}${short}${o.type === 'string' ? ' <valor>' : ''}`
}

/**
 * `util.parseArgs` estricto, con el mensaje completado con los flags válidos:
 * decir sólo "desconocido" deja al operador adivinando el nombre. Sólo los
 * errores de PARSEO son de uso; una configuración rota es un bug y se propaga.
 *
 * @param {string[]} argv
 * @param {Record<string, import('node:util').ParseArgsOptionConfig>} options
 * @param {{ positionals?: boolean }} [opts]
 */
export function parseFlags(argv, options, { positionals = false } = {}) {
  try {
    return parseArgs({ args: argv, options, strict: true, allowPositionals: positionals })
  } catch (e) {
    if (!String(e?.code).startsWith('ERR_PARSE_ARGS')) throw e
    const known = Object.entries(options).map(describeFlag).join(' ') || '(ninguno)'
    throw new UsageError(`${e.message.split('\n')[0]}\n   Flags válidos: ${known}`)
  }
}

/** Un valor fuera de su enumeración se rechaza; caer al default era el defecto. */
export function oneOf(flag, value, allowed) {
  if (value === undefined || allowed.includes(value)) return value
  throw new UsageError(`--${flag} "${value}" no es válido. Valores: ${allowed.join(', ')}`)
}

/** Termina con exit 2 y el mensaje en stderr: la salida común de un error de uso. */
export function exitUsage(message) {
  process.stderr.write(`❌ ${message}\n`)
  process.exit(2)
}

/** Corre `fn`; un `UsageError` sale por stderr con exit 2, cualquier otro sigue. */
export function exitOnUsageError(fn) {
  try {
    return fn()
  } catch (e) {
    if (!(e instanceof UsageError)) throw e
    exitUsage(e.message)
  }
}

/** `parseFlags` para un `main`: lo que no se reconoce termina el proceso con 2. */
export const readFlags = (argv, options, opts) => exitOnUsageError(() => parseFlags(argv, options, opts))
