#!/usr/bin/env node
/**
 * scripts/code-lens/ast-skeletonizer.mjs
 *
 * AOI AST-Lens: plegador LÉXICO de cuerpos de bloque.
 *
 * Conserva imports, tipos, interfaces, clases y las firmas que quedan fuera de
 * un cuerpo plegado, y reemplaza el cuerpo de cada función o método por un
 * marcador de una línea.
 *
 * No es un AST y el nombre lo sobrevendía: el archivo no importa ningún parser
 * —ni acorn, ni ts, ni babel—, sólo `node:fs`, `node:path` y `node:process`, y lo
 * que hace es recorrer caracteres contando profundidad de llaves. Eso alcanza
 * para comprimir y no alcanza para GARANTIZAR nada, que es lo que el encabezado
 * afirmaba:
 *
 *   "Achieves 85-95% token savings on code inspection without loss of API
 *    comprehension."
 *
 * Las dos mitades eran falsas y se midieron (2026-09-12, 239 archivos `.mjs`,
 * `.ts` y `.vue` del repo y del dashboard):
 *
 *   ahorro: mín 0,0% · mediana 70,6% · máx 94,0% · **199 de 239 fuera del rango
 *   prometido**. Tres `.vue` dan 0,0% porque el plegador no toca su estructura.
 *
 *   comprensión: los MIEMBROS de un cuerpo plegado desaparecen. `export class
 *   ResourceOperationError extends Error` pierde su `constructor(message,
 *   readonly statusCode = 400)`; un `export const api = { fetch, save, list }`
 *   queda reducido al marcador de pliegue sin ninguno de los cuatro. Un agente
 *   que lea sólo el esqueleto no puede escribir el `new ResourceOperationError(msg, 404)`
 *   que el contrato pide.
 *
 * Lo que sí sobrevive, verificado: las firmas fuera del pliegue, los campos de
 * `interface` y `type`, `export { a, b }`, `export default`, las funciones
 * flecha exportadas, y un cuerpo de hasta dos líneas, que no se pliega.
 *
 * La Fase 3 del benchmark reporta el ahorro como mérito y cita estos dos
 * archivos: `coeffect-resolver.mjs` 91,2% (no pierde nada) y
 * `resource-operations.ts` 70,4% (pierde el constructor de la clase de error).
 * El número es correcto; leerlo como "sin costo" no lo es.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { scanNonStructural } from './code-scanner.mjs'

/**
 * ¿La llave en `{` abre una FORMA —una lista de import, un tipo, un objeto— y no
 * un cuerpo de función?
 *
 * Plegar una forma no comprime una implementación: **borra el contrato**. Medido,
 * las tres formas que el plegador destruía sin que nada lo mirara:
 *
 *   `import { /* folded *\/ } from './x.mjs'`      → el import queda VACÍO
 *   `export { /* folded *\/ }`                     → el re-export queda VACÍO
 *   `export const config = { /* folded *\/ }`      → el objeto pierde sus claves
 *
 * Y es el peor modo de falla del instrumento: lo que un agente necesita para
 * escribir código correcto es exactamente **qué importa y qué expone** el archivo,
 * y era lo único que el esqueleto ocultaba. El encabezado prometía conservar
 * "imports, tipos, interfaces y firmas", y para un import multilínea no lo hacía.
 *
 * La regla es la del contexto: si el último carácter antes de la llave es un
 * operador de inicialización —`=`, `,`, `(`, `:`, `[`— o viene de `import`,
 * `export` o `return`, es una forma. Si termina en `)` o en `=>`, es un cuerpo.
 */
const SHAPE_PRECEDING_CHARS = '=,(:['

function opensShape(prefix) {
  // El prefijo puede traer marcadores de pliegue ya escritos; no son contexto.
  const p = prefix.replace(/\{ \/\* folded: \d+ lines \*\/ \}/g, ' ').trimEnd()
  if (!p) return false
  // `import { … }` y `export { … }`: la llave que se está mirando TODAVÍA no se
  // escribió, así que el prefijo termina en la palabra clave y no en el `{`. Ésa
  // fue la primera versión de esta regla y no matcheaba nunca: la condición pedía
  // un `{` que sólo existe después. Y la segunda tampoco: el `trimEnd()` de arriba
  // borra el espacio que un `\s+` exigía, así que `import ` quedaba en `import`.
  if (/\b(?:import|export)(?:\s+type)?$/.test(p)) return true
  if (/\b(?:import|export)(?:\s+type)?\s*\{[^{}]*$/.test(p)) return true
  if (/\b(?:return|default|as)\s*$/.test(p)) return true
  return SHAPE_PRECEDING_CHARS.includes(p[p.length - 1])
}

/**
 * Folds block bodies delimited by matching braces { ... }
 *
 * Las DOS pasadas de este archivo —el recorrido externo y el contador que busca
 * la llave de cierre de un cuerpo— comparten `scanNonStructural`, y eso no es
 * una preferencia de estilo. Eran dos implementaciones del mismo escaneo y
 * divergieron: el externo saltaba comentarios y el interno no, así que un
 * apóstrofo en `// the file's block` abría un "string" que se tragaba el resto
 * del archivo, la profundidad se desalineaba y el pliegue cerraba donde no era.
 * Cinco archivos del repo salían con un esqueleto que `node --check` rechaza.
 *
 * @param {string} code 
 * @returns {string}
 */
export function foldBlockBodies(code) {
  let result = ''
  let i = 0
  const len = code.length

  while (i < len) {
    // Comentarios, strings, templates y regex: texto, no estructura. Una sola
    // función decide esto para las dos pasadas — ver `code-scanner.mjs`.
    const texto = scanNonStructural(code, i)
    if (texto) {
      result += code.slice(i, texto.end)
      i = texto.end
      continue
    }

    if (code[i] === '{') {
      // Find matching closing brace
      let depth = 1
      let j = i + 1
      let bodyLines = 0

      // El contador interno usa el MISMO escáner que el recorrido externo.
      // Antes tenía el suyo —sólo strings y llaves, sin comentarios— y la
      // divergencia era el defecto: un apóstrofo en un comentario abría un
      // "string" que se tragaba el resto del archivo.
      //
      // AST-Lens es el mayor ahorro que el benchmark mide, y un esqueleto que
      // descarta declaraciones en silencio es peor que no comprimir: el agente
      // lee un archivo verosímil que no es el archivo.
      while (j < len && depth > 0) {
        const texto = scanNonStructural(code, j)
        if (texto) {
          bodyLines += texto.newlines
          j = texto.end
          continue
        }
        const c = code[j]
        if (c === '{') depth++
        else if (c === '}') depth--
        else if (c === '\n') bodyLines++
        j++
      }

      // Check the preceding tokens on the same line to decide if this is an interface/type vs function
      const prefix = result.slice(Math.max(0, result.length - 120))
      const isTypeOrInterface = /\b(interface|type|enum)\s+[A-Za-z0-9_$]+/.test(prefix) && !/\bfunction\b|\bclass\b|=>/.test(prefix)

      if (isTypeOrInterface || opensShape(prefix) || bodyLines <= 2) {
        // Una forma —import, tipo, interfaz, objeto— se conserva entera: sus
        // miembros SON el contrato. Sólo se pliega un cuerpo de más de dos líneas.
        result += code.slice(i, j)
      } else {
        // Fold the body
        result += `{ /* folded: ${bodyLines} lines */ }`
      }
      i = j
      continue
    }

    result += code[i]
    i++
  }

  return result
}

/**
 * Skeletonizes source code by retaining imports, types, interfaces, exports, and folded signatures.
 *
 * @param {string} sourceCode
 * @param {object} [options]
 * @param {boolean} [options.onlyExports=false]
 * @returns {string}
 */
export function skeletonizeCode(sourceCode = '', options = {}) {
  if (!sourceCode || typeof sourceCode !== 'string') return ''

  // 1. Fold function and implementation bodies
  let folded = foldBlockBodies(sourceCode)

  // 2. Clean consecutive blank lines
  folded = folded.replace(/\n{3,}/g, '\n\n').trim()

  return folded
}

/**
 * CLI Execution
 */
export async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    process.stdout.write(`Usage: aoi:ast-lens <file-path> [--stats]\n`)
    process.exit(0)
  }

  const filePath = path.resolve(args[0])
  if (!fs.existsSync(filePath)) {
    process.stderr.write(`Error: File not found: ${filePath}\n`)
    process.exit(1)
  }

  const raw = fs.readFileSync(filePath, 'utf8')
  const skeleton = skeletonizeCode(raw)

  if (args.includes('--stats')) {
    const rawTokens = Math.round(raw.length / 4)
    const skelTokens = Math.round(skeleton.length / 4)
    const saved = Math.max(0, rawTokens - skelTokens)
    const pct = rawTokens > 0 ? ((saved / rawTokens) * 100).toFixed(1) : 0
    process.stdout.write(`--- AST-Lens Compression Stats ---\n`)
    process.stdout.write(`Original: ${raw.length} bytes (~${rawTokens} tokens)\n`)
    process.stdout.write(`Skeleton: ${skeleton.length} bytes (~${skelTokens} tokens)\n`)
    process.stdout.write(`Saved:    ${saved} tokens (${pct}% reduction)\n\n`)
  }

  process.stdout.write(skeleton + '\n')
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main()
}
