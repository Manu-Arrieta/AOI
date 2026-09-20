/**
 * scripts/multi-harness/entry-point-probe.test.mjs
 *
 * La compuerta que pregunta si el script que la prosa manda correr RESPONDE.
 *
 * Lo que fijan estos casos, y por qué cada uno está:
 *
 *   · La clasificación es pura y tiene CUATRO ramas. La que importa —exit 0 con
 *     salida vacía y sin leer stdin— es la única que reporta, y es la firma
 *     exacta de `synthesize-stubs.mjs` antes de que tuviera `main`.
 *   · El falso positivo que ya apareció una vez: `diagnostic-distiller.mjs` es un
 *     FILTRO de stdin y sin stdin no imprime nada, correctamente. Sin la rama
 *     del stdin la compuerta lo marcaría — y un falso positivo en una compuerta
 *     de la cadena es cómo se la termina silenciando.
 *   · El pipeline, con el runner inyectado, para que cada rama se fije con una
 *     entrada en vez de con un subproceso.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  classifyRun,
  formatEntryPointReport,
  invokedScripts,
  probeEntryPoints,
  readsStdin,
} from './entry-point-probe.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** Un árbol de mentira con prosa y scripts, barrido al final de cada caso. */
function fixture(prose, scripts) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-entry-fixture-'))
  fs.mkdirSync(path.join(root, '.github/prompts'), { recursive: true })
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true })
  fs.writeFileSync(path.join(root, '.github/prompts/p.prompt.md'), prose)
  for (const [name, body] of Object.entries(scripts)) {
    fs.writeFileSync(path.join(root, 'scripts', name), body)
  }
  return { root, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) }
}

const LIBRERIA = 'export function f() { return 1 }\n'
const CON_CLI = 'export function f() { return 1 }\nif (process.argv[1]) main()\n'
const FILTRO = 'async function main() { for await (const c of process.stdin) {} }\nmain()\n'

test('un script que falla al correrlo sin argumentos está bien: es un CLI', () => {
  // La mitad que evita el falso positivo más obvio. Casi todos los CLIs del
  // repo exigen un argumento y salen 1 con el uso.
  assert.equal(classifyRun({ code: 1, output: 'uso: ...', source: LIBRERIA }), 'ok')
})

test('un script que imprime está bien, aunque salga 0', () => {
  assert.equal(classifyRun({ code: 0, output: 'algo\n', source: LIBRERIA }), 'ok')
})

test('un filtro de stdin sin stdin no imprime, y eso es correcto', () => {
  // El falso positivo medido: `diagnostic-distiller.mjs` lee `process.stdin`, y
  // sin entrada no tiene nada que emitir. Marcarlo exigiría un argumento que su
  // contrato no tiene.
  assert.equal(classifyRun({ code: 0, output: '', source: FILTRO }), 'ok')
  assert.equal(readsStdin(FILTRO), true)
  assert.equal(readsStdin(LIBRERIA), false)
})

test('exit 0 con salida vacía y sin stdin es la firma del defecto', () => {
  // La única rama que reporta. Es exactamente lo que hacía `synthesize-stubs.mjs`
  // antes de tener `main`: la prosa lo invocaba y no pasaba nada.
  assert.equal(classifyRun({ code: 0, output: '', source: LIBRERIA }), 'sin-respuesta')
  assert.equal(classifyRun({ code: 0, output: '   \n\t\n', source: LIBRERIA }), 'sin-respuesta')
})

test('invokedScripts lee la prosa y deja afuera los tests', () => {
  // Varios tests se invocan con `node` en la prosa y no son CLIs: incluirlos
  // sería un falso positivo permanente.
  const { root, cleanup } = fixture(
    'Corré `node scripts/a.mjs` y después node scripts/b.mjs. También `node scripts/x.test.mjs`.\n',
    {}
  )
  try {
    assert.deepEqual(invokedScripts(root), ['scripts/a.mjs', 'scripts/b.mjs'])
  } finally {
    cleanup()
  }
})

test('probeEntryPoints reporta el silencioso y el ausente, y calla el que responde', () => {
  const { root, cleanup } = fixture(
    'node scripts/mudo.mjs y node scripts/falta.mjs y node scripts/vivo.mjs\n',
    { 'mudo.mjs': LIBRERIA, 'vivo.mjs': CON_CLI }
  )
  try {
    // El runner se inyecta, así que la respuesta viene de ACÁ y no del fuente:
    // que `vivo.mjs` responda es una propiedad del runner, no del archivo. Ese
    // fue el error de la primera versión de este caso —llamarlo `vivo` y esperar
    // que el fuente alcanzara—, y por eso el runner decide por nombre.
    const run = (rel) =>
      rel.endsWith('vivo.mjs') ? { code: 0, output: 'reporte\n' } : { code: 0, output: '' }
    const r = probeEntryPoints({ root, run })
    assert.equal(r.checked, 3)
    assert.deepEqual(
      r.silent.map((s) => s.file),
      ['scripts/mudo.mjs']
    )
    assert.deepEqual(r.missing, ['scripts/falta.mjs'])
  } finally {
    cleanup()
  }
})

test('un script que responde no se reporta aunque el runner devuelva vacío', () => {
  // La contracara del caso anterior: si el filtro de stdin no estuviera, esto
  // marcaría al vivo como mudo y el control negativo del otro caso pasaría por
  // la razón equivocada.
  const { root, cleanup } = fixture('node scripts/filtro.mjs\n', { 'filtro.mjs': FILTRO })
  try {
    const r = probeEntryPoints({ root, run: () => ({ code: 0, output: '' }) })
    assert.deepEqual(r.silent, [])
  } finally {
    cleanup()
  }
})

test('el reporte dice qué archivo y qué le falta, sin inventar un veredicto', () => {
  const limpio = formatEntryPointReport({ checked: 3, silent: [], missing: [] })
  assert.match(limpio, /✅/)
  assert.match(limpio, /Rutas invocadas: 3/)

  const sucio = formatEntryPointReport({
    checked: 3,
    silent: [{ file: 'scripts/x.mjs', code: 0 }],
    missing: ['scripts/y.mjs'],
  })
  assert.match(sucio, /scripts\/x\.mjs — sale 0 sin imprimir nada/)
  assert.match(sucio, /scripts\/y\.mjs/)
  assert.doesNotMatch(sucio, /✅/)
})

test('este repositorio pasa su propia compuerta', () => {
  // La aserción de integración: las rutas que la prosa invoca existen y
  // responden. Sin esto, la compuerta podría estar verde por vacía.
  const scripts = invokedScripts(ROOT)
  assert.ok(scripts.length >= 15, `sólo ${scripts.length} rutas invocadas: la compuerta quedó vacía`)
  for (const rel of scripts) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `la prosa invoca ${rel} y no existe`)
  }
})
