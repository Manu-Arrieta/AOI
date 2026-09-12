#!/usr/bin/env node
/**
 * scripts/multi-harness/audit-protocol-integrity.mjs
 *
 * El protocolo de auditoría comparativa es prosa EJECUTABLE. Nombra rutas de
 * script, símbolos exportados, banderas y una versión. Nada de eso lo ejecuta
 * nadie, así que un renombre lo pudre en silencio: ninguna compuerta falla, la
 * paridad sigue verde, `aoi:doctor` sigue verde, y el auditor descubre el
 * nombre viejo en el paso donde lo necesita — con el presupuesto de contexto
 * ya gastado y un número a medio construir.
 *
 * Medido antes de escribir esto, y es la razón de que exista: `reference-integrity`
 * sólo lintea referencias `node scripts/x.mjs`. El protocolo escribe 24 de sus
 * rutas desnudas, sin `node` adelante, dentro de los bucles de compuertas. Se
 * renombró una de esas rutas en una copia aislada y la compuerta siguió
 * imprimiendo "Every reference resolves". La clase de falso verde que el propio
 * protocolo persigue, cometida adentro del protocolo.
 *
 * Qué verifica:
 *   1. Toda ruta `scripts/**`.mjs.  nombrada en el protocolo existe.
 *   2. Todo símbolo que el protocolo atribuye a un módulo está exportado ahí.
 *      Se lee el fuente, NUNCA se importa: importar un `.test.mjs` lo vuelve a
 *      correr entero, que es el defecto que este archivo documenta abajo.
 *   3. La versión del encabezado coincide con la que anuncia `docs/README.md`.
 *   4. Existe una sola copia del protocolo en todo el árbol.
 *   5. Verificó algo: cero rutas encontradas es un fallo, no un aprobado.
 *
 * Split estricto/laxo, como `validate-srp` y `validate-test-globs`: en el
 * repositorio de desarrollo (hay `setup.sh`) el protocolo TIENE que estar; en
 * un workspace instalado `docs/` no se envía y la ausencia es legítima.
 *
 * 0 tokens de inferencia. Aritmética de archivos y un regex de exports.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/** La única ubicación legítima del protocolo. */
export const PROTOCOL = 'docs/internal/audits/PROTOCOLO_AUDITORIA_COMPARATIVA.md'

/** El índice que anuncia la versión vigente. */
export const INDEX = 'docs/README.md'

const BASENAME = path.basename(PROTOCOL)

/** Directorios que no aportan y que harían lento el recorrido del árbol. */
const SKIP = new Set(['node_modules', '.git', '.nuxt', 'dist', '.output', '.venv', '.sandboxes'])

/**
 * Los contratos que el protocolo promete y que por lo tanto hay que sostener.
 *
 * Si el protocolo nombra un símbolo y lo atribuye a un módulo, esa pareja es
 * una interfaz. Cambiar el nombre sin cambiar la prosa rompe el protocolo; este
 * arreglo es el que hace que el protocolo se pueda ejecutar tal como está
 * escrito en vez de requerir que el auditor lo repare mientras corre.
 */
export const SYMBOL_CONTRACTS = [
  {
    module: 'scripts/sdd-lifecycle/context-budget.mjs',
    symbols: ['auditContextBudget', 'harnessSkillBands', 'toBudgetRows'],
  },
  {
    module: 'scripts/sdd-lifecycle/cache-prefix.mjs',
    symbols: ['surfaceLoadMap', 'partitionSurface', 'cacheEconomics'],
  },
  {
    module: 'scripts/sdd-lifecycle/token-accounting.mjs',
    symbols: ['estimateTokens'],
  },
  {
    module: 'scripts/multi-harness/token-tool-coverage.mjs',
    symbols: ['invokesTool', 'TOKEN_TOOLS'],
  },
  {
    module: 'scripts/multi-harness/reference-integrity.mjs',
    symbols: ['PROSE_DIRS', 'NARRATIVE_DIRS'],
  },
  {
    module: 'scripts/scaffold/failure-injection.mjs',
    symbols: ['mirror', 'runGate', 'withViolation', 'append', 'prepend', 'sandboxFrom'],
  },
  {
    module: 'scripts/scaffold/validate-test-globs.mjs',
    symbols: ['collectTestGlobs', 'expandGlob'],
  },
]

/**
 * Toda ruta `scripts/**.mjs` nombrada en la prosa.
 *
 * El protocolo escribe las rutas de tres formas: desnudas dentro de los bucles
 * de compuertas, con `node` adelante, y colgando de una raíz variable
 * (`<RUTA_DEL_REPO_AOI>/scripts/...`, `"$WORK/head/scripts/..."`). Las tres
 * describen el mismo archivo relativo a la raíz, así que el prefijo variable se
 * tolera y se descarta. Se excluye únicamente `.github/scripts`, que es otra
 * raíz y no promete nada sobre `scripts/`.
 */
const SCRIPT_REF = /(?:^|[\s(`"'\[]|\/)(?<!\.github\/)(scripts\/[A-Za-z0-9/_.-]+\.mjs)/g

/** Todo archivo bajo `root`, saltando lo pesado y lo que no es fuente. */
export function walkFiles(root, rel = '') {
  const out = []
  const current = path.join(root, rel)
  if (!fs.existsSync(current)) return out
  for (const e of fs.readdirSync(current, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue
    const child = path.join(rel, e.name)
    if (e.isDirectory()) out.push(...walkFiles(root, child))
    else out.push(child)
  }
  return out
}

/**
 * Un segmento entre `<>`, `{}` o `*` es un MARCADOR, no una ruta.
 *
 * El protocolo usa placeholders (`scripts/<archivo>.mjs`) para ilustrar formas
 * sin afirmar que el archivo exista. Contarlos como rutas rompería la compuerta
 * por un ejemplo bien escrito, y una compuerta que hay que desactivar para
 * escribir un ejemplo es una compuerta que se termina desactivando.
 */
const PLACEHOLDER = /[<>*{}]/

/** Rutas de script distintas nombradas en un texto, ordenadas. */
export function scriptRefs(text) {
  return [...new Set([...String(text).matchAll(SCRIPT_REF)].map((m) => m[1]))]
    .filter((ref) => !PLACEHOLDER.test(ref))
    .sort()
}

/** Nombres exportados por un módulo, leídos del fuente. Nunca lo importa. */
export function exportedSymbols(source) {
  const names = new Set()
  const patterns = [
    /^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm,
    /^export\s+(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm,
    /^export\s*\{([^}]*)\}/gm,
  ]
  for (const re of patterns) {
    for (const m of String(source).matchAll(re)) {
      for (const part of m[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop()?.trim()
        if (name) names.add(name)
      }
    }
  }
  return names
}

/** Versión declarada en el encabezado del protocolo. */
export function protocolVersion(text) {
  return /\*\*Versión del Protocolo:\*\*\s*`?v?([\d.]+)`?/.exec(String(text))?.[1] ?? null
}

/** Versión que el índice anuncia para el protocolo. */
export function indexVersion(text) {
  return /\[Protocolo de Auditoría Comparativa v?([\d.]+)\]/.exec(String(text))?.[1] ?? null
}

/** Todas las copias del protocolo en el árbol, en orden estable. */
export function protocolCopies(root) {
  return walkFiles(root)
    .filter((f) => path.basename(f) === BASENAME)
    .sort()
}

/**
 * Corre las cinco verificaciones y devuelve el veredicto.
 *
 * @returns {{ applicable: boolean, errors: string[], verified: Record<string, number> }}
 */
export function auditAuditProtocol(root) {
  const errors = []
  const verified = { scriptRefs: 0, symbols: 0, versions: 0, copies: 0 }

  const protocolFile = path.join(root, PROTOCOL)
  const exists = fs.existsSync(protocolFile)

  // Un instalado no recibe `docs/`: la ausencia ahí no es un hallazgo. En el
  // repositorio de desarrollo —el que tiene el instalador— sí lo es.
  if (!exists) {
    const devRepo = fs.existsSync(path.join(root, 'setup.sh'))
    if (devRepo) errors.push(`falta el protocolo canónico: ${PROTOCOL}`)
    return { applicable: devRepo, errors, verified }
  }

  const text = fs.readFileSync(protocolFile, 'utf8')

  // 1. Rutas de script.
  const refs = scriptRefs(text)
  verified.scriptRefs = refs.length
  if (refs.length === 0) {
    errors.push('el protocolo no nombra ninguna ruta de script: o se vació, o el patrón dejó de matchear')
  }
  for (const ref of refs) {
    if (!fs.existsSync(path.join(root, ref))) errors.push(`ruta inexistente en el protocolo: ${ref}`)
  }

  // 2. Símbolos exportados.
  for (const { module, symbols } of SYMBOL_CONTRACTS) {
    const full = path.join(root, module)
    if (!fs.existsSync(full)) {
      errors.push(`módulo de contrato inexistente: ${module}`)
      continue
    }
    const exported = exportedSymbols(fs.readFileSync(full, 'utf8'))
    for (const symbol of symbols) {
      verified.symbols += 1
      if (!exported.has(symbol)) {
        errors.push(`${module} ya no exporta \`${symbol}\`, y el protocolo lo usa`)
      }
    }
  }

  // 3. Coherencia de versión contra el índice.
  const pv = protocolVersion(text)
  const indexFile = path.join(root, INDEX)
  if (pv && fs.existsSync(indexFile)) {
    verified.versions = 1
    const iv = indexVersion(fs.readFileSync(indexFile, 'utf8'))
    if (!iv) errors.push(`${INDEX} no anuncia ninguna versión del protocolo`)
    else if (iv !== pv) errors.push(`versión divergente: el protocolo dice v${pv} y ${INDEX} dice v${iv}`)
  }

  // 4. Una sola copia.
  const copies = protocolCopies(root)
  verified.copies = copies.length
  if (copies.length > 1) {
    errors.push(`hay ${copies.length} copias del protocolo; sólo una puede ser la vigente: ${copies.join(', ')}`)
  }

  return { applicable: true, errors, verified }
}

/** Reporte legible. Devuelve el código de salida. */
export function formatVerdict({ applicable, errors, verified }) {
  if (!applicable) {
    console.log('· Sin protocolo de auditoría en este workspace (instalado): nada que verificar.')
    return 0
  }
  const { scriptRefs: refs, symbols, versions, copies } = verified
  console.log('=== Integridad del Protocolo de Auditoría Comparativa ===')
  console.log(`  rutas de script:   ${refs}`)
  console.log(`  contratos:         ${symbols} símbolos sobre ${SYMBOL_CONTRACTS.length} módulos`)
  console.log(`  versiones:         ${versions} comparada(s) contra ${INDEX}`)
  console.log(`  copias:            ${copies}`)
  if (errors.length) {
    console.log(`\n❌ ${errors.length} problema(s):`)
    for (const e of errors) console.log(`   · ${e}`)
    return 1
  }
  console.log(`\n✅ El protocolo describe el sistema que existe (${refs} rutas, ${symbols} símbolos).`)
  return 0
}

/* c8 ignore start -- envoltura de CLI */
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  process.exit(formatVerdict(auditAuditProtocol(REPO)))
}
/* c8 ignore stop */
