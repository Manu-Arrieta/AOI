/**
 * scripts/sdd-lifecycle/benchmark-inputs.mjs
 *
 * Los insumos FIJOS del benchmark y su huella, para que un delta se pueda
 * interpretar.
 *
 * El defecto que cierra. Hay fases del stress-suite que miden archivos FIJOS:
 * `/sdd-apply` lee siempre los mismos dos para ejercitar AST-Lens. Su ahorro en
 * tokens es un número ABSOLUTO, y ese número escala con el tamaño de esos
 * archivos. Si el código crece, el ahorro baja aunque el mecanismo comprima
 * exactamente igual.
 *
 * Medido el 2026-09-13: `resource-operations.ts` pasó de 9.291 a 14.008 bytes
 * entre `v2.1.0` y hoy, y el ahorro de la fase bajó de 81% a 77%. Un lector
 * apurado lo lee como una regresión del mecanismo. No lo es: el RATIO de
 * compresión quedó idéntico (92% en `coeffect-resolver`, 64% vs 65% en
 * `resource-operations`), y lo único que cambió es que el archivo tiene más
 * código.
 *
 * La consecuencia es de lectura, no de cálculo: los absolutos de esas fases NO
 * son comparables entre revisiones y los ratios SÍ. Reportar el tamaño del
 * insumo junto al resultado es lo que permite distinguir las dos causas de un
 * delta sin bucear en la historia de git.
 *
 * Vive en su propio módulo y no dentro de `stress-report.mjs` porque ese
 * archivo declara su frontera: "the suite MEASURES ... everything here only
 * READS what has already been decided and arranges it for a human". Medir los
 * insumos no es arreglar lo decidido.
 */

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Los insumos fijos, por fase.
 *
 * Se declaran acá y no se infieren de la suite porque la suite no los expone: el
 * ledger guarda el RESULTADO de leerlos, no qué leyó. Declararlos es lo que hace
 * que la huella se pueda comparar contra la corrida anterior.
 */
export const FIXED_BENCHMARK_INPUTS = [
  {
    phase: 'Phase_3_Apply',
    why: 'AST-Lens mide siempre estos dos archivos',
    files: [
      'scripts/spatiotemporal-runtime/coeffect-resolver.mjs',
      'aoi_apps/agentic-ops-dashboard/server/utils/resource-operations.ts',
    ],
  },
]

/**
 * La huella de un conjunto de archivos: cuántos bytes y qué contenido.
 *
 * El lector es inyectable para poder fijar el contrato sin depender del árbol:
 * un caso que lea el repositorio real mide el repositorio, no la función.
 *
 * @param {string[]} files rutas relativas
 * @param {(f: string) => string} read lector inyectable
 * @returns {{ bytes: number, files: number, missing: string[], digest: string }}
 */
export function fingerprintInputs(files, read = (f) => fs.readFileSync(f, 'utf8')) {
  const hash = createHash('sha256')
  let bytes = 0
  const missing = []
  for (const f of files) {
    let contenido
    try {
      contenido = read(f)
    } catch {
      missing.push(f)
      continue
    }
    bytes += contenido.length
    // El separador evita que dos archivos distintos den la misma huella por
    // concatenación: `ab` + `c` y `a` + `bc` son el mismo string.
    hash.update(`${f}\0${contenido}\0`)
  }
  return { bytes, files: files.length, missing, digest: hash.digest('hex').slice(0, 16) }
}

/**
 * El bloque de comparabilidad, listo para imprimir.
 *
 * Dice tres cosas y las tres hacen falta: qué archivos se leyeron, cuánto pesan
 * con su huella, y la regla de interpretación. Sin la regla, el número es dato
 * sin consecuencia; sin la huella, no hay forma de saber si cambió el insumo o
 * el mecanismo.
 *
 * @param {string} root raíz del repositorio
 * @param {Array} inputs declaración de insumos
 * @param {(files: string[]) => object} fp calculador inyectable
 */
export function formatComparability(
  root,
  inputs = FIXED_BENCHMARK_INPUTS,
  fp = (files) => fingerprintInputs(files.map((f) => path.join(root, f)))
) {
  const lines = [
    'COMPARABILIDAD DE LOS INSUMOS FIJOS:',
    'Estas fases miden archivos que NO cambian con el ciclo. Su ahorro en tokens',
    'es absoluto y escala con el tamaño del insumo; su % de reducción no.',
    '',
  ]
  for (const entrada of inputs) {
    const f = fp(entrada.files)
    lines.push(`  ${entrada.phase} — ${entrada.why}`)
    lines.push(`    archivos: ${f.files}${f.missing.length > 0 ? ` (faltan ${f.missing.length})` : ''} · ${f.bytes} bytes · huella ${f.digest}`)
    lines.push(`    ${entrada.files.map((x) => path.basename(x)).join(' · ')}`)
  }
  lines.push(
    '',
    'CÓMO LEER UN DELTA: si la huella cambió, el insumo cambió — el delta de',
    'tokens puede ser del archivo y no del mecanismo. El % de reducción de la',
    'tabla es el ratio, y ese sí es comparable entre revisiones.'
  )
  return lines.join('\n')
}
