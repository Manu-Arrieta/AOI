/**
 * scripts/scaffold/protocol-single-source.test.mjs
 *
 * El protocolo de verificación tiene exactamente dos copias: la de la raíz y
 * su espejo en `scaffold/`, que la paridad mantiene byte a byte. Cualquier
 * tercera copia queda fuera de esa vigilancia y deriva sin que nada falle.
 *
 * Pasó. Las tres copias eran idénticas en v2.1.0 y, nueve commits después, la
 * de `docs/internal/verification/` había quedado 317 líneas atrás — con la
 * línea base vieja y sin el ciclo más reciente. Lo grave no era el duplicado
 * sino que los CUATRO enlaces de entrada del repositorio apuntaban a ella y
 * ninguno a la vigente: un operador que siguiera el README corría un
 * protocolo obsoleto y comparaba contra una línea base que ya no existía.
 *
 * Nada lo detectó porque la paridad sólo mira rutas gobernadas, el linter de
 * referencias sólo mira prosa ejecutable, y ningún test leía los README. Esta
 * es la compuerta que faltaba, y cuesta 0 tokens de inferencia.
 *
 * Por qué `.conf/` se ignora, y es un defecto medido. Esta compuerta recorría
 * el filesystem —no `git ls-files`— y `.conf/` no existe en el repositorio de
 * desarrollo, así que acá siempre pasó limpia. En una instalación real sí
 * existe: es el directorio donde el instalador guarda su snapshot de
 * configuración y, en `conflicts/`, los archivos que chocaron durante un
 * reinstall. Medido en `AOI TESTS` el 2026-09-16: un reinstall del día anterior
 * había dejado `.conf/conflicts/AOI_REAL_WORLD_VERIFICATION_MATRIX.md`, y esta
 * compuerta lo contaba como una tercera copia sin gobernar. **`pnpm test`
 * quedaba en rojo de forma permanente por un artefacto que el propio instalador
 * creó**, y ninguna acción del Owner lo arreglaba salvo borrar a mano evidencia
 * de conflicto que existe justamente para ser consultada.
 *
 * `.conf/` entra a la lista por la misma razón que `node_modules`: está en el
 * `.gitignore` de la raíz y del scaffold, no se versiona, y su contenido son
 * copias por diseño —`snapshots/` replica prompts, agentes, scripts y configs
 * enteros—. Nadie lo lee como fuente de autoridad ni enlaza hacia adentro. Lo
 * que esta compuerta persigue es una copia a la que un operador pueda ser
 * ruteado, y a `.conf/` no lo rutea nadie.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, after } from 'node:test'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const PROTOCOL = 'AOI_REAL_WORLD_VERIFICATION_MATRIX.md'

/**
 * La única ubicación legítima: la raíz del repositorio fuente.
 *
 * Eran dos, porque el protocolo viajaba en el scaffold hasta cada workspace
 * instalado. Son 99 KB que describen cómo se verifica AOI, en proyectos que no
 * son AOI: ningún script, prompt, agente ni compuerta los lee para decidir nada
 * — sus dos consumidores de código eran esta prueba y la lista de paridad, o
 * sea, vigilancia sobre el propio archivo. El Owner lo retiró del destino el
 * 2026-09-17, por la misma razón por la que el andamio no queda instalado.
 */
const GOBERNADAS = [PROTOCOL]

/**
 * Directorios que no vale la pena recorrer y nunca contienen fuente propia.
 *
 * `.conf` es estado del instalador, no del repositorio: snapshots de
 * configuración y archivos en conflicto de un reinstall. Está gitignoreado en
 * la raíz y en el scaffold. Sin él acá, toda instalación que alguna vez tuvo un
 * conflicto sobre el protocolo quedaba con la suite en rojo para siempre.
 */
const IGNORAR = new Set(['node_modules', '.git', '.nuxt', 'dist', '.output', '.sandboxes', '.conf'])

/** Toda ruta relativa bajo `dir`, saltándose lo que no es fuente del repo. */
function recorrer(dir, rel = '') {
  const out = []
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    if (IGNORAR.has(e.name)) continue
    const hijo = path.join(rel, e.name)
    if (e.isDirectory()) out.push(...recorrer(dir, hijo))
    else out.push(hijo)
  }
  return out
}

/** Toda copia del protocolo que haya bajo `root`, en orden estable. */
export function copiasDelProtocolo(root) {
  return recorrer(root).filter((f) => path.basename(f) === PROTOCOL).sort()
}

// Se lee el enlace tal cual lo escribió el autor y se resuelve desde el
// archivo que lo contiene, que es exactamente lo que hace quien lo clickea.
const ENLACE = /\]\(([^)\s]*AOI_REAL_WORLD_VERIFICATION_MATRIX\.md)[^)]*\)/g

/** Enlaces al protocolo que no resuelven, como `archivo → destino`. */
export function enlacesRotos(root) {
  const rotos = []
  for (const rel of recorrer(root).filter((f) => f.endsWith('.md'))) {
    const texto = fs.readFileSync(path.join(root, rel), 'utf8')
    for (const m of texto.matchAll(ENLACE)) {
      const destino = path.resolve(path.dirname(path.join(root, rel)), m[1])
      if (!fs.existsSync(destino)) rotos.push(`${rel} → ${m[1]}`)
    }
  }
  return rotos.sort()
}

describe('el protocolo de verificación tiene una sola fuente', () => {
  it('existe únicamente en la raíz y en su espejo gobernado', () => {
    assert.deepEqual(
      copiasDelProtocolo(REPO),
      [...GOBERNADAS].sort(),
      'apareció una copia del protocolo fuera de las rutas que la paridad vigila: va a derivar sin que nada falle',
    )
  })
})

describe('todo enlace al protocolo resuelve', () => {
  it('ningún README ni documento apunta a una ruta inexistente', () => {
    assert.deepEqual(enlacesRotos(REPO), [], 'hay enlaces al protocolo que no resuelven')
  })
})

describe('control negativo — la compuerta reconoce el defecto que la motivó', () => {
  /**
   * Directorios descartables, borrados al cerrar el describe.
   *
   * Acumulados y no limpiados caso por caso porque el helper se invoca inline y
   * no hay variable por test donde borrar. Medido: 6 directorios por corrida
   * quedaban en `$TMPDIR` para siempre.
   */
  const temporales = []
  after(() => {
    for (const dir of temporales) fs.rmSync(dir, { recursive: true, force: true })
  })

  // Sin esto no habría forma de distinguir una compuerta que verifica de una
  // que sale 0 porque no miró nada, que es media auditoría de este proyecto.
  function arbolConTerceraCopia() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-protocolo-'))
    temporales.push(dir)
    fs.mkdirSync(path.join(dir, 'scaffold'), { recursive: true })
    fs.mkdirSync(path.join(dir, 'docs/internal/verification'), { recursive: true })
    fs.writeFileSync(path.join(dir, PROTOCOL), 'vigente\n')
    fs.writeFileSync(path.join(dir, 'scaffold', PROTOCOL), 'vigente\n')
    fs.writeFileSync(path.join(dir, 'docs/internal/verification', PROTOCOL), 'vieja\n')
    fs.writeFileSync(path.join(dir, 'README.md'), `[Protocolo](docs/internal/verification/${PROTOCOL})\n`)
    return dir
  }

  it('detecta la tercera copia que nadie gobierna', () => {
    const copias = copiasDelProtocolo(arbolConTerceraCopia())
    assert.equal(copias.length, 3)
    assert.ok(copias.some((c) => c.includes('docs')), 'no vio la copia fuera de paridad')
  })

  /**
   * El árbol que tenía `AOI TESTS` el 2026-09-16, más la copia que la compuerta
   * SÍ debe seguir viendo. Van juntas en un solo fixture a propósito: separadas,
   * cada mitad se puede aprobar con una exclusión demasiado ancha o demasiado
   * angosta, y sólo el par prueba que el corte cae donde tiene que caer.
   */
  function arbolInstaladoConConflicto() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-protocolo-'))
    temporales.push(dir)
    for (const sub of ['scaffold', '.conf/conflicts', '.conf/snapshots/configs', 'docs/internal/verification']) {
      fs.mkdirSync(path.join(dir, sub), { recursive: true })
    }
    fs.writeFileSync(path.join(dir, PROTOCOL), 'vigente\n')
    fs.writeFileSync(path.join(dir, 'scaffold', PROTOCOL), 'vigente\n')
    fs.writeFileSync(path.join(dir, '.conf/conflicts', PROTOCOL), 'en conflicto\n')
    fs.writeFileSync(path.join(dir, '.conf/snapshots/configs', PROTOCOL), 'snapshot previo\n')
    fs.writeFileSync(path.join(dir, 'docs/internal/verification', PROTOCOL), 'vieja\n')
    return dir
  }

  it('ignora las copias que el instalador deja en .conf/', () => {
    // El defecto medido: sin esto, un reinstall con conflicto dejaba `pnpm test`
    // en rojo permanente por evidencia que el instalador creó a propósito.
    const copias = copiasDelProtocolo(arbolInstaladoConConflicto())
    assert.ok(
      !copias.some((c) => c.includes('.conf')),
      `contó estado del instalador como fuente: ${copias.join(', ')}`,
    )
  })

  it('pero sigue detectando la copia sin gobernar del mismo árbol', () => {
    // El par del control anterior: prueba que la exclusión es quirúrgica y no
    // un agujero que deja pasar la tercera copia que motivó esta compuerta.
    const copias = copiasDelProtocolo(arbolInstaladoConConflicto())
    assert.deepEqual(copias, [PROTOCOL, `docs/internal/verification/${PROTOCOL}`, `scaffold/${PROTOCOL}`].sort())
  })

  it('detecta un enlace que apunta a una ruta que no existe', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-protocolo-'))
    temporales.push(dir)
    fs.writeFileSync(path.join(dir, PROTOCOL), 'vigente\n')
    fs.writeFileSync(path.join(dir, 'README.md'), `[Protocolo](docs/internal/verification/${PROTOCOL})\n`)

    assert.deepEqual(enlacesRotos(dir), [`README.md → docs/internal/verification/${PROTOCOL}`])
  })
})
