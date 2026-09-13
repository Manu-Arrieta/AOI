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

const DECLARATION_KEYWORDS = ['function', 'class', 'const', 'let', 'var', 'interface', 'type', 'enum']
const DECLARATION = new RegExp(
  `^(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?(?:${DECLARATION_KEYWORDS.join('|')})\\s+([A-Za-z_$][\\w$]*)`
)

/**
 * Los NOMBRES de las declaraciones de nivel superior —o sea, el contrato que el
 * esqueleto promete conservar—.
 *
 * El escaneo lo hace `scanNonStructural`, y no es un detalle: sin él, un nombre
 * declarado adentro de un comentario o de un string contaría como declaración y
 * esta compuerta tendría falsos positivos. Se probó sobre los 64 archivos del
 * área y da 0 falsos positivos, que es la condición para que sirva.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
function topLevelDeclarations(text) {
  const out = new Set()
  let i = 0
  let depth = 0

  while (i < text.length) {
    const texto = scanNonStructural(text, i)
    if (texto) {
      i = texto.end
      continue
    }
    const c = text[i]
    if (c === '{') { depth++; i++; continue }
    if (c === '}') { depth--; i++; continue }
    if (depth === 0) {
      const m = DECLARATION.exec(text.slice(i, i + 120))
      if (m) out.add(m[1])
    }
    i++
  }

  return out
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

  it('NO pierde declaraciones de nivel superior, que compilar no garantiza', () => {
    // La pregunta que faltaba, y la diferencia importa. "La salida compila" NO es
    // la promesa del instrumento: la promesa es **no descartar declaraciones**.
    //
    // Medido: si el contador de un cuerpo se pasa de largo, el pliegue se come
    // todo lo que sigue y emite `{ /* folded: N lines */ }` — el resultado es un
    // módulo **más corto pero perfectamente válido**. Pasa `node --check` y el
    // agente lee un archivo verosímil al que le faltan la mitad de sus funciones.
    // Es exactamente el modo de falla que el encabezado del plegador declara
    // inaceptable, y la compuerta de sintaxis no lo ve.
    //
    // El control negativo con el contador viejo lo confirma: la sintaxis cazó 5
    // archivos, pero un contador que se pasa de largo por poco produce una salida
    // válida y trunca. Por eso esta compuerta mira CONTENIDO y no sintaxis.
    const files = sources(path.join(REPO_ROOT, 'scripts'))
    const conPerdidas = []

    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8')
      const enFuente = topLevelDeclarations(src)
      const enEsqueleto = topLevelDeclarations(skeletonizeCode(src))
      const perdidas = [...enFuente].filter((n) => !enEsqueleto.has(n))
      if (perdidas.length > 0) conPerdidas.push(`${path.relative(REPO_ROOT, f)}: ${perdidas.join(', ')}`)
    }

    assert.deepEqual(conPerdidas, [], 'el esqueleto se comió declaraciones que la fuente sí tiene')
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

