/**
 * scripts/multi-harness/undocumented-commands.mjs
 *
 * La dirección que `auditFile` nunca mira.
 *
 * `reference-integrity` recorre las superficies narrativas y exige que todo
 * comando que NOMBRAN exista como prompt. Nunca pregunta lo contrario, y esa
 * asimetría deja pasar el caso que se pierde de verdad: un prompt que existe y
 * que ninguna superficie nombra. `/sdd-genesis` vivió así —el archivo estaba,
 * la wiki no lo conocía— y ningún test podía notarlo porque todos miraban para
 * el mismo lado. Es la forma de las otras costuras que esta auditoría encontró:
 * una relación con una sola dirección verificada.
 *
 * Vive en su propio módulo y no dentro de `reference-integrity.mjs` porque la
 * pregunta es distinta —"¿existe lo que se nombra?" contra "¿se nombra lo que
 * existe?"— y porque ese archivo ya está en el borde de las 300 LOC.
 *
 * Alcance acotado a los prompts `sdd-*`, a propósito. Los `speckit.*` llegan
 * con spec-kit: exigirle a la documentación de AOI que los cubra sería pedirle
 * que documente código ajeno, y el día que spec-kit agregue un comando el
 * repositorio se rompería por algo que no escribió nadie de acá.
 */

import fs from 'node:fs'
import path from 'node:path'

/** Prefijo de los prompts que escribe AOI. */
export const AOI_OWNED_COMMAND_PREFIX = 'sdd-'

const PROMPT_SUFFIX = '.prompt.md'

/**
 * ¿Repositorio de desarrollo o workspace instalado?
 *
 * El marcador es el mismo que ya usan `validate-srp` y `validate-test-globs`.
 * @param {string} root
 * @returns {boolean}
 */
function isDevelopmentRepo(root) {
  return fs.existsSync(path.join(root, 'setup.sh'))
}

/**
 * Comandos SDD que existen como prompt y que ninguna superficie narrativa
 * menciona.
 *
 * Sólo corre en el repositorio de desarrollo. En un workspace instalado la
 * prosa es del Owner y la wiki ni se copia: reclamarle que documente los
 * comandos de AOI sería juzgarlo por un texto que nunca se le entregó.
 *
 * @param {string} root
 * @param {string[]} narrativeFiles Rutas relativas a root, ya recolectadas.
 * @returns {{ checked: number, undocumented: string[], skipped: boolean }}
 */
export function auditUndocumentedCommands(root, narrativeFiles = []) {
  if (!isDevelopmentRepo(root)) return { checked: 0, undocumented: [], skipped: true }

  let owned = []
  try {
    owned = fs
      .readdirSync(path.join(root, '.github/prompts'))
      .filter((name) => name.startsWith(AOI_OWNED_COMMAND_PREFIX) && name.endsWith(PROMPT_SUFFIX))
      .map((name) => name.slice(0, -PROMPT_SUFFIX.length))
  } catch {
    // Sin directorio de prompts no hay comandos que exigir. No es un fallo: la
    // compuerta de cero entradas ya existe y vive en el otro módulo, que es
    // donde se sabe cuántos archivos se escanearon.
    return { checked: 0, undocumented: [], skipped: false }
  }

  const prose = narrativeFiles
    .map((rel) => {
      try {
        return fs.readFileSync(path.join(root, rel), 'utf8')
      } catch {
        return ''
      }
    })
    .join('\n')

  return {
    checked: owned.length,
    // Se busca la forma de invocación (`/sdd-x`), no el nombre suelto: un
    // documento que nombra el ARCHIVO no está enseñando el COMANDO, y
    // tolerarlo convertiría esta compuerta en una que siempre pasa.
    undocumented: owned.filter((name) => !prose.includes(`/${name}`)).sort(),
    skipped: false,
  }
}

/**
 * Formatea el resultado como reporte compacto.
 * @param {{ checked: number, undocumented: string[], skipped: boolean }} result
 * @returns {string}
 */
export function formatUndocumented({ checked, undocumented, skipped } = {}) {
  if (skipped) {
    return (
      '=== Comandos SDD documentados ===\n' +
      '⏭️  Workspace instalado: la prosa es del Owner y no se le exige cubrir comandos de AOI.'
    )
  }
  if (!undocumented || undocumented.length === 0) {
    return `✅ Los ${checked} comandos SDD tienen mención en la documentación.`
  }
  return [
    `❌ ${undocumented.length} de ${checked} comandos SDD sin documentar:`,
    ...undocumented.map((name) => `  /${name} — el prompt existe y ninguna superficie lo nombra`),
  ].join('\n')
}
