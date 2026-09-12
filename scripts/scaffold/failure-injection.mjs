/**
 * scripts/scaffold/failure-injection.mjs
 *
 * El instrumental para inyectar fallas en una copia descartable.
 *
 * El protocolo de auditoría comparativa le exige al auditor probar que cada
 * compuerta puede fallar, y le prohíbe hacerlo sobre el árbol de trabajo. Ese
 * trabajo tenía un patrón escrito, pero vivía adentro de
 * `gate-exit-codes.test.mjs` — como funciones privadas de un archivo de test.
 * Dos consecuencias, las dos malas:
 *
 *   1. El protocolo decía "reusalas, no escribas uno nuevo" y era inejecutable:
 *      `import` de un `.test.mjs` no expone nada y además VUELVE A CORRER la
 *      suite entera. El auditor que seguía la instrucción al pie de la letra
 *      metía una corrida completa de tests adentro de su propio script.
 *   2. Todo el que necesitaba inyectar una falla copiaba el patrón a mano, que
 *      es exactamente lo que la instrucción quería evitar.
 *
 * Sacarlo a un módulo real cierra las dos. Un módulo, un trabajo: preparar una
 * copia, medir una compuerta por su código de salida, y dejar el original como
 * estaba. Nada de esto importa un modelo ni gasta tokens de inferencia.
 *
 * Regla de uso, y es la razón de que este archivo exista:
 *   NUNCA inyectes fallas en el árbol de trabajo. Copiá, rompé, medí, borrá.
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Directorios que sólo engordan la copia y que ninguna compuerta lee.
 * Copiar `node_modules` convierte una copia de milisegundos en una de minutos.
 */
export const SKIP = new Set(['node_modules', '.git', '.nuxt', 'dist', '.output', '.venv', '.sandboxes'])

/**
 * Copia recursivamente un árbol a un directorio descartable.
 *
 * @param {string} src raíz de origen
 * @param {string} dest raíz de destino, se crea si no existe
 * @param {Set<string>} skip nombres de entrada que no se copian
 */
export function mirror(src, dest, skip = SKIP) {
  fs.mkdirSync(dest, { recursive: true })
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip.has(e.name)) continue
    const from = path.join(src, e.name)
    const to = path.join(dest, e.name)
    if (e.isDirectory()) mirror(from, to, skip)
    else if (e.isFile()) fs.copyFileSync(from, to)
    else if (e.isSymbolicLink()) fs.symlinkSync(fs.readlinkSync(from), to)
  }
}

/**
 * Corre una compuerta dentro de la copia y devuelve su código de salida.
 *
 * Nunca lanza: un exit distinto de cero es el DATO que el auditor vino a
 * buscar, no un error del programa. El timeout existe porque una compuerta
 * colgada y una compuerta que aprueba son indistinguibles desde afuera salvo
 * por el reloj.
 *
 * @returns {number} 0 verde, el código real si falló, 124 si se colgó
 */
export function runGate(root, script, timeoutMs = 120000) {
  try {
    execFileSync('node', [script], { cwd: root, stdio: 'ignore', timeout: timeoutMs })
    return 0
  } catch (e) {
    return e.status ?? 1
  }
}

/**
 * Aplica una mutación, mide la compuerta, y deja el archivo como estaba.
 *
 * El `finally` es lo que hace que el ciclo se pueda repetir: sin él, la primera
 * violación inyectada contamina todas las mediciones siguientes, y el auditor
 * termina comparando su propio daño contra sí mismo.
 *
 * @param {string} root copia descartable
 * @param {string} relFile ruta relativa a mutar
 * @param {(full: string, original: string|null) => void} mutate
 * @param {string} script compuerta a medir
 * @returns {number} código de salida de la compuerta
 */
export function withViolation(root, relFile, mutate, script) {
  const full = path.join(root, relFile)
  const original = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null
  try {
    mutate(full, original)
    return runGate(root, script)
  } finally {
    if (original === null) fs.rmSync(full, { force: true })
    else fs.writeFileSync(full, original)
  }
}

/** Mutador: agrega texto al final del archivo. */
export const append = (text) => (full, original) => fs.writeFileSync(full, `${original}\n${text}\n`)

/** Mutador: agrega texto al principio del archivo — donde vive el prefijo cacheado. */
export const prepend = (text) => (full, original) => fs.writeFileSync(full, `${text}\n${original}`)

/** Crea una copia descartable del repositorio y devuelve su ruta. */
export function sandboxFrom(repoRoot, prefix = 'aoi-gates-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  mirror(repoRoot, dir)
  return dir
}
