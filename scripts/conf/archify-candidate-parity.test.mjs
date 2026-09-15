/**
 * scripts/conf/archify-candidate-parity.test.mjs
 *
 * CUATRO implementaciones tienen que estar de acuerdo sobre DÓNDE vive el
 * renderizador de Archify: `doctor-checks.mjs` (que decide si la skill está
 * sana), `install-archify.sh` y `install-archify.ps1` (que la instalan), y
 * `setup.sh` (que avisa si falta).
 *
 * Si divergen, el modo de falla es silencioso y de los peores: el instalador
 * escribe en una ruta, el doctor busca en otra, y el resultado es un WARNING
 * que dice "no instalada" sobre una skill perfectamente instalada. Nadie mira
 * dos archivos distintos para descubrirlo.
 *
 * Esta lista de cuatro SÍ se revisa entera. La versión anterior cubría tres —
 * doctor y los dos instaladores — y la que quedaba afuera era justamente la que
 * había divergido: `get_archify_path()` en `setup.sh` tenía tres rutas mientras
 * el resto tenía cuatro. Verificar tres de cuatro lugares no es verificar: deja
 * afuera, por construcción, al que se desvió.
 *
 * El `.ps1` no se puede ejecutar en esta máquina —no hay `pwsh` ni
 * `powershell`— así que esto no reemplaza haberlo corrido. Verifica la parte
 * que sí es verificable sin Windows: que las cuatro listas sean la misma lista,
 * en el mismo orden.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { findArchifyRenderer } from '../doctor-checks.mjs'
import { ARCHIFY_RENDERER_CANDIDATES } from '../archify-checks.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8')
const SH = read('scripts/install-archify.sh')
const PS1 = read('scripts/install-archify.ps1')
// La CUARTA implementación de la lista, y la que este test no miraba. Fue la
// que estaba mal: `get_archify_path()` tenía tres rutas y el doctor cuatro, así
// que en un lugar donde el CLI deja el paquete anidado bajo Claude Code el
// instalador avisaba "Archify no está instalado" sobre una skill instalada.
// Un test que verifica tres de cuatro lugares deja afuera justo al que diverge.
const SETUP_SH = read('setup.sh')

/**
 * La lista canónica viene de `archify-checks.mjs`, no de una copia escrita acá.
 *
 * Antes era una constante literal, y eso dejaba el mismo hueco que este archivo
 * existe para cerrar: si alguien agregaba una quinta ruta a la fuente, esta
 * copia no se enteraba, el test seguía verde comparando tres listas viejas
 * entre sí, y la única que había cambiado quedaba sin verificar. Derivarla hace
 * que el cambio de la fuente viaje al test solo.
 *
 * Las cuatro existen porque el CLI `skills` cambia dónde deja el paquete según
 * su versión: plano o anidado, y bajo la raíz de Codex/Antigravity o la de
 * Claude Code.
 */
const CANONICAL = ARCHIFY_RENDERER_CANDIDATES

/** Lee el nombre de la skill del propio instalador, en vez de asumirlo. */
function skillName(source, pattern, label) {
  const match = source.match(pattern)
  assert.ok(match, `${label} ya no declara el nombre de la skill`)
  return match[1]
}

const SH_NAME = skillName(SH, /^SKILL_NAME=["']?([\w-]+)["']?/m, 'install-archify.sh')
const PS1_NAME = skillName(PS1, /^\$SkillName\s*=\s*"([\w-]+)"/m, 'install-archify.ps1')

/**
 * Rutas declaradas por un instalador, normalizadas a la forma relativa del HOME.
 *
 * Anclado a la LÍNEA y no al texto suelto a propósito: los dos instaladores
 * también nombran la ruta esperada dentro de sus mensajes de error, y contar
 * esos como declaraciones haría que el test midiera la prosa en vez de la
 * lista. Medido: la extracción laxa devolvía 6 entradas para el `.ps1`, con la
 * primera repetida dos veces — que es exactamente un verde falso esperando a
 * que alguien lo interprete como una divergencia real.
 *
 * @param {string} source
 * @param {RegExp} linePattern captura el fragmento posterior a `$HOME/`
 * @param {string} [placeholder] el nombre de variable a sustituir; sin él la
 *   ruta se devuelve tal cual, que es lo que necesita `setup.sh`.
 * @param {string} [value]
 */
function declared(source, linePattern, placeholder = '', value = '') {
  const out = []
  for (const line of source.split('\n')) {
    const match = line.match(linePattern)
    if (!match || !match[1].endsWith('archify.mjs')) continue
    out.push(placeholder ? match[1].replaceAll(placeholder, value) : match[1])
  }
  return out
}

const shCandidates = () =>
  declared(SH, /^\s*"\$HOME\/([^"]+)"\s*\\?\s*$/, '$SKILL_NAME', SH_NAME)

const ps1Candidates = () =>
  declared(PS1, /^\s*\(Join-Path\s+\$HOME\s+"([^"]+)"\),?\s*$/, '$SkillName', PS1_NAME)

// La última candidata de `setup.sh` cierra el bucle con `; do`, así que el
// patrón tiene que tolerarlo además de la barra de continuación.
const setupShCandidates = () =>
  declared(setupShBlock(), /^\s*"\$HOME\/([^"]+)"\s*(?:\\|;.*)?$/)

// El bloque de la función, aislado: así el conteo no se contamina con otras
// rutas `$HOME/...archify.mjs` que pudieran aparecer en mensajes de error.
const setupShBlock = () => {
  const start = SETUP_SH.indexOf('get_archify_path() {')
  assert.ok(start > 0, 'setup.sh ya no define get_archify_path()')
  return SETUP_SH.slice(start, SETUP_SH.indexOf('\n}', start) + 2)
}

describe('las cuatro implementaciones buscan el renderizador en el mismo lugar', () => {
  it('los dos instaladores apuntan a la misma skill', () => {
    assert.equal(SH_NAME, 'archify')
    assert.equal(PS1_NAME, SH_NAME, 'los instaladores se separaron de skill')
  })

  it('el doctor cubre las 4 rutas y respeta el orden de precedencia', (t) => {    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-archify-home-'))
    t.after(() => fs.rmSync(home, { recursive: true, force: true }))

    for (const rel of CANONICAL) {
      const abs = path.join(home, rel)
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      fs.writeFileSync(abs, '// renderer\n')
    }

    // Se borran de a una para leer el ORDEN. Comprobar sólo que encuentra
    // alguna dejaría pasar dos listas con el mismo contenido y distinto orden,
    // y el orden es la precedencia: quien gana cuando hay más de una.
    for (const rel of CANONICAL) {
      assert.equal(findArchifyRenderer(home), path.join(home, rel))
      fs.rmSync(path.join(home, rel))
    }
    assert.equal(findArchifyRenderer(home), '', 'sin ninguna presente no debe inventar una ruta')
  })

  it('install-archify.sh declara las mismas 4, en el mismo orden', () => {
    assert.deepEqual(shCandidates(), CANONICAL)
  })

  it('install-archify.ps1 declara las mismas 4, en el mismo orden', () => {
    assert.deepEqual(ps1Candidates(), CANONICAL)
  })

  it('setup.sh declara las mismas 4, en el mismo orden', () => {
    // Esta es la que faltaba, y la que estaba mal. `setup.sh` decide si avisar
    // "Archify no está instalado", y esa frase tiene que estar de acuerdo con
    // el PASSED del doctor: son dos respuestas sobre la misma máquina.
    assert.deepEqual(setupShCandidates(), CANONICAL)
  })

  it('el .ps1 se queda dentro de PowerShell 5.1', () => {
    // `setup.sh` sanitiza este archivo antes de pasárselo a `powershell.exe`,
    // o sea que PS 5.1 es un destino soportado. `&&`, `||` y `??` son de PS 7:
    // usarlos rompería exactamente el camino que el sanitizer existe para
    // servir, y en la máquina del Owner Windows, no acá.
    const code = PS1.split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n')
    for (const op of ['&&', '||', '??']) {
      assert.equal(code.includes(op), false, `operador que sólo existe en PS 7: ${op}`)
    }
  })
})
