#!/usr/bin/env node
/**
 * scripts/scaffold/run-suite.mjs
 *
 * Corre una suite `node --test` de `package.json` sólo si sus tests están acá, y
 * cuando no están lo DICE en vez de reportar un verde sobre cero.
 *
 * Auditoría 2026-09-30 (C5), medido sobre una instalación core real con
 * `setup.sh --yes`: `scripts/conf/` no se instala —sus tests leen `setup.sh`, que
 * tampoco viaja—, `aoi:test-globs` en modo lenient lo lista como "no instalado,
 * se tolera", y dos pasos después la cadena corría `pnpm test:conf`, que imprimía
 * `tests 0 · pass 0` y salía 0. El gate decía la verdad y el paso de la suite la
 * desmentía: un verde de la suite sobre ninguna aserción.
 *
 * La tolerancia del gate es correcta —el workspace instalado no tiene esos
 * tests, legítimamente— y por eso el arreglo no está ahí: está en el paso que la
 * cadena corre. Es el mismo precedente que `dashboard-command.mjs`, que en un
 * perfil sin dashboard imprime "omitido" en vez de correr nada en silencio.
 *
 *   · Instalado y sin el directorio de la suite → `⏭️ omitido`, exit 0.
 *   · Repositorio de desarrollo (`setup.sh` en la raíz) y sin el directorio → 1:
 *     acá la suite tiene que existir, el mismo criterio estricto del gate.
 *   · Un directorio que existe sin ningún test que matchee → 1, en los dos lados.
 *   · Mitad instalada y mitad no → 1: un verde parcial no se lee como completo.
 *
 * La decisión de "¿este glob está acá?" la toma `expandGlob` de
 * `validate-test-globs.mjs`, importada y no copiada: dos respuestas a la misma
 * pregunta terminan divergiendo.
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { expandGlob } from './validate-test-globs.mjs'

const PURE_SUITE = /^node\s+--test\s+([^&|;]+)$/

/**
 * Qué hacer con la suite `name` del `package.json` de `root`.
 * @returns {{ mode: 'run'|'omit'|'error', reason?: string, args?: string[] }}
 */
export function planSuite(root, name) {
  const pkgPath = path.join(root, 'package.json')
  const scripts = fs.existsSync(pkgPath) ? (JSON.parse(fs.readFileSync(pkgPath, 'utf8')).scripts ?? {}) : {}
  const body = scripts[name]
  if (typeof body !== 'string') return { mode: 'error', reason: `package.json no define el script "${name}"` }
  const m = PURE_SUITE.exec(body.trim())
  if (!m) return { mode: 'error', reason: `"${name}" no es una suite \`node --test <globs>\` pura: ${body}` }

  const tokens = m[1].trim().split(/\s+/)
  const globs = tokens.filter((t) => !t.startsWith('-'))
  const expanded = globs.map((glob) => ({ glob, ...expandGlob(root, glob) }))
  const absent = expanded.filter((e) => !e.dirExists)
  const empty = expanded.filter((e) => e.dirExists && e.matches.length === 0)
  const strict = fs.existsSync(path.join(root, 'setup.sh'))

  if (empty.length > 0) return { mode: 'error', reason: `${empty.map((e) => e.glob).join(', ')} no matchea ningún archivo` }
  if (absent.length > 0) {
    const dirs = [...new Set(absent.map((e) => e.dir))].join(', ')
    if (strict) return { mode: 'error', reason: `${dirs} no existe en el repositorio de desarrollo` }
    if (absent.length < expanded.length) return { mode: 'error', reason: `instalación parcial: falta ${dirs} y el resto de la suite sí está` }
    return { mode: 'omit', reason: `${dirs} no se instala en este workspace` }
  }
  return { mode: 'run', args: ['--test', ...tokens] }
}

/** Corre la suite según `planSuite`. Devuelve el código de salida. */
export function runSuite(root, name, run = spawnSync) {
  const plan = planSuite(root, name)
  if (plan.mode === 'omit') {
    process.stdout.write(`⏭️  ${name} omitido: ${plan.reason}. 0 tests corridos — esto no es un verde de la suite.\n`)
    return 0
  }
  if (plan.mode === 'error') {
    process.stderr.write(`❌ ${name}: ${plan.reason}.\n`)
    return 1
  }
  const result = run(process.execPath, plan.args, { cwd: root, stdio: 'inherit' })
  if (result.error) return 1
  return result.status ?? 1
}

function invokedDirectly() {
  try {
    return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
}

if (invokedDirectly()) {
  const args = process.argv.slice(2)
  if (args.length !== 1 || args[0].startsWith('-')) {
    process.stderr.write('Uso: node scripts/scaffold/run-suite.mjs <script-de-package.json>\n')
    process.exitCode = 2
  } else {
    process.exitCode = runSuite(process.cwd(), args[0])
  }
}
