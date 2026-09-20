/**
 * scripts/conf/fresh-snapshot-empty-target.test.mjs
 *
 * La foto previa de `setup.sh` decide si la reparación de Fase 3 corre, y su
 * caso más importante es el más fácil de confundir con un fracaso: un destino
 * SIN ARCHIVOS produce una foto de 0 bytes, y eso es un DATO VÁLIDO.
 *
 * El defecto medido. El guard era `[ -s "$FRESH_SNAPSHOT" ]`, o sea que la
 * validez se infería del TAMAÑO. En un destino sin archivos la foto quedaba
 * vacía, el guard la leía como "no hay foto", la reparación se salteaba entera y
 * los 14 agentes `speckit.*` se quedaban con la versión de spec-kit, sin su
 * bloque `## Model Requirement` — exactamente el defecto que ese paso existe para
 * reparar. Medido: destino vacío 13/27 agentes con bloque; con un solo archivo,
 * 27/27. Dispara con cualquier destino de cero archivos en todo el árbol,
 * incluido uno que solo tenga directorios vacíos, porque `find . -type f` no
 * lista directorios.
 *
 * Por qué ningún test lo veía: los archivos de `scripts/conf/` LEEN `setup.sh`
 * como texto. El bug era una condición de runtime —0 bytes— invisible a una
 * aserción textual. `FRESH_SNAPSHOT` no aparecía en ningún test.
 *
 * Por eso este archivo extrae el bloque REAL del instalador y lo EJECUTA por
 * bash contra destinos de verdad. Un test que parafrasea la lógica prueba la
 * paráfrasis; el mismo criterio que `installer-input-safety.test.mjs` usa para
 * la expansión de `~`.
 *
 * El fallo de `find` se inyecta con un directorio INEXISTENTE (`cd` falla) y no
 * con `chmod 000`: un subdirectorio ilegible no restringe nada a root, así que
 * esa vía daría verde en un contenedor y rojo en una máquina.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SETUP = fs.readFileSync(path.join(REPO, 'setup.sh'), 'utf8')

/** Marcadores del bloque, elegidos para no depender de números de línea. */
const START = 'FRESH_SNAPSHOT_OK=0'
const END = '# Qué stdin darle'

/**
 * El bloque de la foto previa, tal cual está en `setup.sh`.
 *
 * Se corta entre dos marcadores en vez de con una regex balanceada de `if/fi`:
 * una regex así se rompe en silencio con el primer `fi` interno, y este archivo
 * existe justamente porque un silencio se comió 14 agentes.
 */
function snapshotBlock() {
  const from = SETUP.indexOf(START)
  const to = SETUP.indexOf(END, from)
  assert.ok(from > -1, `setup.sh ya no define ${START}: el bloque se movió o se renombró`)
  assert.ok(to > from, `no se encontró el cierre del bloque de la foto previa (${END})`)
  return SETUP.slice(from, to)
}

const BLOCK = snapshotBlock()

/**
 * Corre el bloque real con un `PROJECT_PATH` dado y devuelve el estado que dejó.
 *
 * `warn` se stubea porque el bloque lo usa desde que informa una foto que no se
 * pudo tomar, y el cuerpo de esa rama no es lo que este test fija.
 */
function snapshotFlag(projectPath, isReinstall = 0) {
  const script = `
    warn() { :; }
    # Extraer el bloque extrae también sus OBLIGACIONES. El bloque hace \`mktemp\`,
    # y en setup.sh ese temporal lo borra el \`trap cleanup_temp_files EXIT\`, que
    # vive FUERA del slice que este test recorta. Sin reponerlo acá, cada llamada
    # deja un \`aoi-preinstalacion.XXXXXX\` de 0 bytes en \$TMPDIR: medido 2026-09-20,
    # **4 por corrida de \`pnpm test\`** y sin techo — 419 acumulados.
    trap 'rm -f "\${FRESH_SNAPSHOT:-}"' EXIT
    IS_REINSTALL="$2"
    PROJECT_PATH="$1"
${BLOCK}
    printf '%s' "$FRESH_SNAPSHOT_OK"
  `
  const out = execFileSync('bash', ['-c', script, 'x', projectPath, String(isReinstall)], {
    encoding: 'utf8',
    env: { ...process.env, LC_ALL: 'C' },
  })
  return out.trim()
}

/** Directorios temporales, borrados al cerrar: si no, dejan basura por corrida. */
function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-snapshot-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  return dir
}

describe('una foto vacía es un dato válido, no un fallo', () => {
  it('acepta un destino sin archivos, que es el caso que el fix existe para cubrir', (t) => {
    const empty = tempDir(t)

    assert.equal(
      snapshotFlag(empty),
      '1',
      'un destino sin archivos se lee como foto inválida: la reparación de Fase 3 no corre y los 14 agentes speckit.* pierden su bloque'
    )
  })

  it('acepta un destino que solo tiene directorios, porque find -type f no los lista', (t) => {
    const dirsOnly = tempDir(t)
    fs.mkdirSync(path.join(dirsOnly, 'src', 'components'), { recursive: true })
    fs.mkdirSync(path.join(dirsOnly, 'docs'), { recursive: true })

    assert.equal(snapshotFlag(dirsOnly), '1')
  })

  it('acepta un destino con archivos, que es el caso que nunca estuvo roto', (t) => {
    const populated = tempDir(t)
    fs.writeFileSync(path.join(populated, 'README.md'), '# proyecto\n')

    assert.equal(snapshotFlag(populated), '1')
  })

  it('rechaza una foto que no se pudo tomar, para no reparar sobre datos parciales', (t) => {
    const missing = path.join(tempDir(t), 'no-existe')

    assert.equal(
      snapshotFlag(missing),
      '0',
      'un destino ilegible se reporta como válido, así que la reparación corre sobre una foto parcial y puede pisar archivos que ya existían'
    )
  })

  it('no corre en una reinstalación, donde specify init se saltea y no hay nada que reparar', (t) => {
    assert.equal(snapshotFlag(tempDir(t), 1), '0')
  })
})

describe('la foto previa sigue registrando lo que había', () => {
  it('fotografía los archivos del destino, con paths relativos a la raíz', (t) => {
    const project = tempDir(t)
    fs.mkdirSync(path.join(project, 'src'), { recursive: true })
    fs.writeFileSync(path.join(project, 'README.md'), 'x')
    fs.writeFileSync(path.join(project, 'src', 'main.mjs'), 'x')

    const script = `
      warn() { :; }
      IS_REINSTALL=0
      PROJECT_PATH="$1"
${BLOCK}
      cat "$FRESH_SNAPSHOT"
      rm -f "$FRESH_SNAPSHOT"
    `
    const out = execFileSync('bash', ['-c', script, 'x', project], { encoding: 'utf8' })

    assert.deepEqual(out.split('\n').filter(Boolean).sort(), ['./README.md', './src/main.mjs'])
  })
})

describe('la reparación no vuelve a mirar el tamaño de la foto', () => {
  // El bug no fue escribir el guard mal una vez: fue que NADA ejecutaba
  // `setup.sh`, así que volver a inferir la validez del tamaño no tenía quién lo
  // detuviera. Esta aserción es textual a propósito — es la única forma barata de
  // fijar que el guard sea por ESTADO y no por TAMAÑO.
  it('no gatea la restauración con -s sobre la foto', () => {
    const live = SETUP.split('\n').filter((l) => !/^\s*#/.test(l))

    assert.deepEqual(
      live.filter((l) => /-s\s+"?\$FRESH_SNAPSHOT"?/.test(l)),
      [],
      'la validez de la foto volvió a inferirse de su tamaño: una foto vacía es un destino sin archivos, no un fracaso'
    )
  })

  it('gatea la restauración con el estado que reportó la foto', () => {
    assert.match(
      SETUP,
      /if \[ "\$FRESH_SNAPSHOT_OK" -eq 1 \]/,
      'el guard de la restauración ya no usa el estado de la foto'
    )
  })
})
