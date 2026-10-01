/**
 * scripts/sdd-lifecycle/invariant-gate-args.mjs
 *
 * La línea de comandos del Invariant Gate, estricta.
 *
 * Auditoría 2026-09-30 (D2): `main` leía los flags con `args.includes` e
 * `indexOf`, así que aceptaba cualquier cosa. `--bogus` salía 0, y un typo de
 * `--exit-code` (`--exit-cod`) convertía una auditoría FAILED en exit 0: el flag
 * que decide si la compuerta frena la cadena se perdía sin un aviso. Igual con
 * `--entity` sin valor, que caía callado en la entidad inferida, o con
 * `--entity --exit-code`, que tomaba el flag como nombre de la entidad.
 *
 * Un flag desconocido, un valor ausente o un argumento suelto salen con 2, el
 * mismo código que BLOCKED: no se pudo hacer la pregunta que se pidió.
 */

/** Flags que llevan un valor, y la clave de opción donde queda. */
const VALUE_FLAGS = Object.freeze({
  '--entity': 'entity',
  '--facts-file': 'factsFile',
  '--tests-dir': 'testsDir',
  '--bic': 'bicFilter',
})

/** Flags booleanos, y la clave de opción que encienden. */
const BOOLEAN_FLAGS = Object.freeze({
  '--json': 'asJson',
  '--exit-code': 'enforceExitCode',
  '--chain': 'chain',
  '-h': 'help',
  '--help': 'help',
})

export const USAGE =
  'Usage: node scripts/sdd-lifecycle/invariant-gate.mjs [--entity <WORKSPACE>] ' +
  '[--facts-file <table.txt>] [--tests-dir <dir>] [--bic <BIC-ID>] [--json] [--exit-code] [--chain]\n'

export const HELP =
  USAGE +
  '\n--entity se resuelve solo (git remote origin, con fallback a\n' +
  'basename del directorio) cuando no se pasa --entity ni --facts-file.\n' +
  '\nExit codes (with --exit-code):\n' +
  '  0  PASSED, or SKIPPED when --entity is EXPLICIT and the workspace has no bic.* facts\n' +
  '     PARTIAL too: every rule has a test, but some only run on another platform\n' +
  '  1  FAILED — a declared invariant or oracle has no test asserting it\n' +
  '  2  BLOCKED — the contract could not be read, OR an INFERRED entity has no\n' +
  '     bic.* facts. An inferred name cannot tell "this task never ran\n' +
  '     /sdd-frame" from "I guessed the wrong entity", and SKIPPED would be a\n' +
  '     silent pass on a guessed name. Pass --entity to assert it.\n' +
  '     Also an unknown flag or a flag missing its value.\n' +
  '\n--chain is --exit-code for `pnpm test`: when the contract is unreachable here\n' +
  '(no icm on PATH, unknown entity, no bic.* facts) it reports NOT AUDITED and\n' +
  'exits 0 instead of blocking. A failing icm or an unreadable table still exit 2.\n'

/**
 * @param {string[]} argv los argumentos, sin `node` ni el script
 * @returns {{ opts?: object, error?: string }}
 */
export function parseGateArgs(argv) {
  const opts = { entity: '', factsFile: '', testsDir: '', bicFilter: '', asJson: false, enforceExitCode: false, chain: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (Object.hasOwn(VALUE_FLAGS, arg)) {
      const value = argv[i + 1]
      if (value === undefined || value === '' || value.startsWith('-')) return { error: `${arg} necesita un valor` }
      opts[VALUE_FLAGS[arg]] = value
      i++
    } else if (Object.hasOwn(BOOLEAN_FLAGS, arg)) {
      opts[BOOLEAN_FLAGS[arg]] = true
    } else {
      return { error: `argumento desconocido: ${arg}` }
    }
  }
  // `--chain` es la invocación de `pnpm test`: sin código de salida no frenaría nada.
  if (opts.chain) opts.enforceExitCode = true
  return { opts }
}
