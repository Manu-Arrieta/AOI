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

const REGEX_PRECEDING_KEYWORDS = new Set([
  'return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'instanceof',
  'do', 'else', 'yield', 'await', 'new',
])
const REGEX_PRECEDING_PUNCT = '(,=:[!&|?{};+-*%~^<>'

/**
 * ¿La barra en `i` abre una regex o es una división?
 *
 * Hay que decidirlo léxicamente porque en JavaScript las llaves de una regex
 * son TEXTO: `s.replace(/}/g, '')` tiene un `}` que no cierra nada. El plegador
 * no conocía las regex, así que ese `}` le bajaba la profundidad y el bloque se
 * cerraba antes de tiempo, dejando el resto de la función **huérfano fuera del
 * cuerpo** — no una pérdida de contrato sino código sintácticamente roto.
 *
 * La heurística es la habitual: después de un operador o de una palabra clave
 * que espera una expresión, una barra abre una regex; después de un nombre, un
 * número, `)` o `]`, divide. `a++ /b/` quedaría mal clasificado —es ambiguo sin
 * parsear— y está declarado como límite conocido en el test.
 */
function isRegexStart(code, i) {
  let k = i - 1
  while (k >= 0 && /\s/.test(code[k])) k--
  if (k < 0) return true
  if (REGEX_PRECEDING_PUNCT.includes(code[k])) return true
  if (/[A-Za-z_$]/.test(code[k])) {
    let start = k
    while (start >= 0 && /[A-Za-z0-9_$]/.test(code[start])) start--
    return REGEX_PRECEDING_KEYWORDS.has(code.slice(start + 1, k + 1))
  }
  return false
}

/** Consume una regex literal y devuelve el índice siguiente, o `null` si esa
 * barra no abría una regex. `null` es la respuesta que deja todo como estaba. */
function skipRegex(code, i) {
  if (code[i] !== '/' || !isRegexStart(code, i)) return null
  let j = i + 1
  let inClass = false
  while (j < code.length) {
    const c = code[j]
    if (c === '\\') { j += 2; continue }
    if (c === '\n') return null // una regex no cruza de línea
    if (c === '[') inClass = true
    else if (c === ']') inClass = false
    else if (c === '/' && !inClass) { j++; break }
    j++
  }
  while (j < code.length && /[a-z]/i.test(code[j])) j++ // flags
  return j
}

/**
 * Folds block bodies delimited by matching braces { ... }
 * @param {string} code 
 * @returns {string}
 */
export function foldBlockBodies(code) {
  let result = ''
  let i = 0
  const len = code.length

  while (i < len) {
    // Check for comments or strings to avoid false brace matching
    if (code.slice(i, i + 2) === '//') {
      const eol = code.indexOf('\n', i)
      const comment = eol === -1 ? code.slice(i) : code.slice(i, eol + 1)
      result += comment
      i += comment.length
      continue
    }

    if (code.slice(i, i + 2) === '/*') {
      const endC = code.indexOf('*/', i + 2)
      const comment = endC === -1 ? code.slice(i) : code.slice(i, endC + 2)
      result += comment
      i += comment.length
      continue
    }

    if (code[i] === '"' || code[i] === "'" || code[i] === '`') {
      const quote = code[i]
      let str = quote
      i++
      while (i < len && code[i] !== quote) {
        if (code[i] === '\\' && i + 1 < len) {
          str += code[i] + code[i + 1]
          i += 2
        } else {
          str += code[i]
          i++
        }
      }
      if (i < len) {
        str += code[i]
        i++
      }
      result += str
      continue
    }

    // Las llaves de una regex son texto, y una `{` de una regex abría un bloque
    // que no existía: el plegado se comía todo lo que viniera después.
    if (code[i] === '/') {
      const end = skipRegex(code, i)
      if (end !== null) {
        result += code.slice(i, end)
        i = end
        continue
      }
    }

    // Look for function / method / constructor definitions before an open brace
    if (code[i] === '{') {
      // Find matching closing brace
      let depth = 1
      let j = i + 1
      let bodyLines = 0

      // Braces inside a string are text, not structure. The outer pass already
      // knows this and skips strings; this inner counter did not, so a body
      // holding an unbalanced brace — `"}"`, a regex, a JSON fragment, a
      // template literal — closed at the wrong place and swallowed every
      // function that followed. Balanced ones cancelled out and hid the bug.
      //
      // AST-Lens is the largest saving the benchmark measures, and a skeleton
      // that silently drops declarations is worse than no compression: the
      // agent reads a plausible file that is not the file.
      let inString = null
      while (j < len && depth > 0) {
        const c = code[j]

        if (inString) {
          if (c === '\\') { j += 2; continue }
          if (c === '\n') bodyLines++
          if (c === inString) inString = null
          j++
          continue
        }

        if (c === '\n') { bodyLines++; j++; continue }

        if (c === '"' || c === "'" || c === '`') {
          inString = c
          j++
          continue
        }

        // Misma razón que en el pasada externa: el contador interno tampoco
        // conocía las regex, así que un `}` dentro de una le cerraba el cuerpo.
        if (c === '/') {
          const end = skipRegex(code, j)
          if (end !== null) { j = end; continue }
        }

        if (c === '{') depth++
        else if (c === '}') depth--
        j++
      }

      // Check the preceding tokens on the same line to decide if this is an interface/type vs function
      const prefix = result.slice(Math.max(0, result.length - 120))
      const isTypeOrInterface = /\b(interface|type|enum)\s+[A-Za-z0-9_$]+/.test(prefix) && !/\bfunction\b|\bclass\b|=>/.test(prefix)

      if (isTypeOrInterface || bodyLines <= 2) {
        // Keep interface, type, or short inline objects unfolded
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
