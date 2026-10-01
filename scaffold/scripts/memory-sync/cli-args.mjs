/**
 * scripts/memory-sync/cli-args.mjs
 *
 * The argument shape the memory bundle CLIs share.
 *
 * Both `export-memory-bundle` and `import-memory-bundle` take the same three
 * positional values — workspace, version id, artifact path — followed by
 * flags, and each had written its own fifty-line loop to read them. The two
 * loops were the same code with different flag names, and neither had a test:
 * every mutant the probe planted inside them survived.
 *
 * Estricto desde la auditoría 2026-09-30 (D4): el bucle compartido aceptaba
 * CUALQUIER clave y saltaba un flag sin valor. `--scopes memories` (con s) no
 * era un error: dejaba `scope` vacío, y `export-memory-bundle` lee la lista
 * vacía como "todos los scopes" — se exportaba todo por un typo. Ahora lo
 * desconocido, lo que no tiene valor y lo que sobra es un `UsageError`.
 */

import { UsageError, parseFlags } from '../sdd-lifecycle/cli-flags.mjs'

/**
 * Los flags de un solo valor que los dos CLIs leen. Ninguno de los dos pasa
 * todavía su propia lista, así que el default es la unión: sigue aceptando `--owner-context` en el export, pero ya no un nombre
 * que ninguno de los dos lee.
 */
export const BUNDLE_VALUE_FLAGS = ['versions-root', 'exports-root', 'exported-at', 'format-version', 'owner-context']

/**
 * Splits `argv` into the three positional values and a flag map.
 *
 * A flag named in `lists` may repeat and accumulates; every flag in `values`
 * keeps its last value. Anything else throws `UsageError`.
 *
 * @param {string[]} argv
 * @param {{ lists?: string[], values?: string[] }} [options]
 * @returns {{ workspace: string, versionId: string, relativeArtifactPath: string,
 *   flags: Record<string, string | string[]> }}
 */
export function parseBundleArgs(argv = [], { lists = [], values = BUNDLE_VALUE_FLAGS } = {}) {
  const options = {}
  for (const name of values) options[name] = { type: 'string' }
  for (const name of lists) options[name] = { type: 'string', multiple: true }

  // `util.parseArgs` no mira el tipo de cada token: un `null` revienta adentro
  // con un TypeError ajeno y un `42` se vuelve el versionId. `process.argv` sólo
  // trae strings, así que otra cosa es un bug del llamador y se dice como tal.
  const bad = argv.findIndex((token) => typeof token !== 'string')
  if (bad > -1) throw new TypeError(`argv sólo admite strings, recibió ${String(argv[bad])} en la posición ${bad}`)

  const parsed = parseFlags(argv, options, { positionals: true })
  const [workspace, versionId, relativeArtifactPath, ...extra] = parsed.positionals
  if (extra.length > 0) {
    throw new UsageError(`sobra un argumento: "${extra[0]}". Uso: <workspace> <versionId> <ruta> [--flags]`)
  }

  const flags = {}
  for (const name of lists) flags[name] = []
  for (const [key, value] of Object.entries(parsed.values)) flags[key] = value
  return { workspace, versionId, relativeArtifactPath, flags }
}
