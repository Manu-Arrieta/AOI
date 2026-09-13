/**
 * scripts/code-lens/skeletonizer-validity.test.mjs
 *
 * El gate que faltaba, y que dejó pudrirse cinco archivos.
 *
 * La suite cubría el ahorro —"el esqueleto es más chico y conserva la firma"— y
 * los bordes del escáner. **Nadie verificaba que el esqueleto fuera un programa
 * válido.** Cinco de 63 archivos `.mjs`/`.js` del repo producían una salida que
 * `node --check` rechaza, incluido `coeffect-resolver.mjs`, que la Fase 3 del
 * benchmark cita como su mayor ahorro (91,2%).
 *
 * Y eso es lo peor que puede pasar con este instrumento. Una pérdida de contrato
 * se nota cuando el agente escribe el import mal; un esqueleto **roto** no se
 * nota al leerlo: el agente lee un archivo verosímil que no es el archivo. Por eso
 * la compuerta no es "el ahorro está en rango" sino **"la salida compila"**, y se
 * verifica con el toolchain real y no con una segunda implementación del escaneo
 * —que es exactamente el defecto que la causó.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, describe, it } from 'node:test'
import { skeletonizeCode } from './ast-skeletonizer.mjs'
import { scanNonStructural } from './code-scanner.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '../..')

const SKIP = new Set(['node_modules', '.git', '.nuxt', '.output', 'dist', 'build', 'coverage', 'scaffold'])
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-skel-validity-'))

after(() => fs.rmSync(tmp, { recursive: true, force: true }))

/** Los `.mjs`/`.js` de un árbol, sin tests ni directorios de build. */
function sources(dir) {
  const out = []
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue
      const full = path.join(d, e.name)
      if (e.isDirectory()) walk(full)
      else if (/\.(mjs|js)$/.test(e.name) && !e.name.includes('.test.')) out.push(full)
    }
  }
  walk(dir)
  return out
}

/** ¿El texto es un módulo que Node acepta? Nunca a través de un pipe. */
function compila(text) {
  const file = path.join(tmp, 'x.mjs')
  fs.writeFileSync(file, text)
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

describe('el esqueleto de todo el árbol compila, o el instrumento miente', () => {
  it('ningún archivo de scripts/ produce una salida que node --check rechace', () => {
    const files = sources(path.join(REPO_ROOT, 'scripts'))
    assert.ok(files.length > 30, `sólo se escanearon ${files.length} archivos: el gate no estaría midiendo nada`)

    const rotos = files.filter((f) => !compila(skeletonizeCode(fs.readFileSync(f, 'utf8'))))

    assert.deepEqual(
      rotos.map((f) => path.relative(REPO_ROOT, f)),
      [],
      'el esqueleto de estos archivos no es un programa válido: el agente leería algo verosímil que no es el archivo'
    )
  })

  it('las FUENTES también compilan: un delimitador dentro de un comentario rompe el archivo', () => {
    // El mismo barrido, una línea más arriba, y no es redundante. En esta misma
    // sesión tres archivos quedaron con un error de sintaxis por escribir un
    // delimitador DENTRO de contenido: `/* folded */` adentro de un JSDoc cerró
    // el comentario, un `*/` en un mensaje, y un salto de línea crudo en medio de
    // un `//`. Los tres se habrían cazado acá en vez de en la suite entera.
    const files = sources(path.join(REPO_ROOT, 'scripts'))
    const rotos = files.filter((f) => !compila(fs.readFileSync(f, 'utf8')))

    assert.deepEqual(
      rotos.map((f) => path.relative(REPO_ROOT, f)),
      [],
      'estos archivos no parsean: revisá si un delimitador quedó adentro de un comentario'
    )
  })

  // El caso que costó cinco archivos. Vale como regresión puntual, además del
  // barrido, porque el barrido depende del contenido del repo y esto no.
  it('un apóstrofo en un comentario NO se traga el archivo', () => {
    const src = [
      'export function f(a) {',
      "  // the file's leading block, and it doesn't stop here",
      '  const x = 1',
      '  return x',
      '}',
      '',
      'export function g(b) {',
      '  const y = 2',
      '  return y',
      '}',
      '',
    ].join('\n')

    const out = skeletonizeCode(src)

    assert.ok(compila(out), 'el esqueleto no compila: un apóstrofo en un comentario desalineó la profundidad')
    assert.match(out, /g\(b\)/, 'se comió la función que venía después del comentario')
  })

  it('un template con bloques de markdown escapados no cierra antes de tiempo', () => {
    // El segundo caso medido: el cuerpo de `generateClaudeMd` es un template con
    // ``` ```bash ``` ``` adentro y `${}` con llamadas. Tratar la interpolación
    // como texto cierra el template en el primer backtick interno.
    const src = [
      'export function doc(w) {',
      '  return `# ${w}',
      '',
      '```bash',
      'pnpm aoi:doctor',
      '```',
      '`',
      '}',
      '',
      'export function siguiente(a) {',
      '  const z = 1',
      '  return z',
      '}',
      '',
    ].join('\n')

    const out = skeletonizeCode(src)

    assert.ok(compila(out), 'el esqueleto no compila: el template cerró en el backtick de markdown')
    assert.match(out, /siguiente\(a\)/, 'se comió la función que venía después del template')
  })
})

describe('las dos pasadas del plegador comparten el escáner', () => {
  // La compuerta que impide la re-divergencia, y es la lección de A.13 aplicada:
  // *si dos partes tienen que coincidir en cómo leen lo mismo, tienen que
  // compartir el código que lo lee*. Antes había dos escaneos —el externo saltaba
  // comentarios, el interno no— y la diferencia era el defecto. Un comentario que
  // nombre las funciones no debe romper esto.
  const source = () =>
    fs
      .readFileSync(path.join(HERE, 'ast-skeletonizer.mjs'), 'utf8')
      .split('\n')
      .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
      .join('\n')

  it('no volvió a tener un contador de strings propio', () => {
    const src = source()
    assert.doesNotMatch(src, /inString/, 'reapareció el escáner interno que causó los cinco archivos rotos')
    assert.doesNotMatch(src, /function skipRegex|function isRegexStart/, 'el escaneo léxico volvió a este archivo')
  })

  it('usa scanNonStructural en el recorrido externo y en el contador interno', () => {
    const llamadas = source().match(/scanNonStructural\(/g) ?? []
    assert.equal(llamadas.length, 2, `esperaba las dos pasadas usando el escáner compartido, encontré ${llamadas.length}`)
  })
})

describe('el escáner compartido, caso por caso', () => {
  it('salta un comentario de línea hasta el salto, no hasta el fin del archivo', () => {
    const src = "// uno\nconst a = 1\n"
    const r = scanNonStructural(src, 0)
    assert.equal(src.slice(r.end), 'const a = 1\n')
    assert.equal(r.newlines, 1)
  })

  it('un string de una línea termina en el salto aunque no tenga cierre', () => {
    // La defensa que acota el daño: en JS un string no cruza un `\n` sin
    // escapar, así que un apóstrofo suelto corta ahí en vez de comerse el archivo.
    const src = "// it doesn't\nconst a = 1\n"
    const r = scanNonStructural(src, 0)
    assert.equal(src.slice(r.end), 'const a = 1\n', 'el comentario se comió el resto del archivo')
  })

  it('cuenta los saltos de un bloque de comentario', () => {
    const r = scanNonStructural('/* a\nb\nc */resto', 0)
    assert.equal(r.newlines, 2)
    assert.equal(r.end, '/* a\nb\nc */'.length)
  })

  it('devuelve null cuando no hay nada que saltar', () => {
    assert.equal(scanNonStructural('const a = 1', 0), null)
    assert.equal(scanNonStructural('a / b', 2), null, 'una división no es una región no estructural')
  })

  it('recorre una interpolación con llaves y strings adentro', () => {
    const src = '`x ${ { a: "}" } } y` luego'
    const r = scanNonStructural(src, 0)
    assert.equal(src.slice(r.end), ' luego', 'la interpolación no cerró donde debía')
  })
})
