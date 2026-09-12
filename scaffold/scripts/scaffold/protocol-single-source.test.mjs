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
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const PROTOCOL = 'AOI_REAL_WORLD_VERIFICATION_MATRIX.md'

/** Las dos únicas ubicaciones legítimas, ambas gobernadas por la paridad. */
const GOBERNADAS = [PROTOCOL, path.join('scaffold', PROTOCOL)]

/** Directorios que no vale la pena recorrer y nunca contienen fuente propia. */
const IGNORAR = new Set(['node_modules', '.git', '.nuxt', 'dist', '.output', '.sandboxes'])

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

  it('las dos copias gobernadas son idénticas', () => {
    const [a, b] = GOBERNADAS.map((f) => fs.readFileSync(path.join(REPO, f), 'utf8'))
    assert.equal(a, b, 'la raíz y el scaffold publican protocolos distintos')
  })
})

describe('todo enlace al protocolo resuelve', () => {
  it('ningún README ni documento apunta a una ruta inexistente', () => {
    assert.deepEqual(enlacesRotos(REPO), [], 'hay enlaces al protocolo que no resuelven')
  })
})

describe('control negativo — la compuerta reconoce el defecto que la motivó', () => {
  // Sin esto no habría forma de distinguir una compuerta que verifica de una
  // que sale 0 porque no miró nada, que es media auditoría de este proyecto.
  function arbolConTerceraCopia() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-protocolo-'))
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

  it('detecta un enlace que apunta a una ruta que no existe', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-protocolo-'))
    fs.writeFileSync(path.join(dir, PROTOCOL), 'vigente\n')
    fs.writeFileSync(path.join(dir, 'README.md'), `[Protocolo](docs/internal/verification/${PROTOCOL})\n`)

    assert.deepEqual(enlacesRotos(dir), [`README.md → docs/internal/verification/${PROTOCOL}`])
  })
})
