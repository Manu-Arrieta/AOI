#!/usr/bin/env node
/**
 * scripts/sdd-lifecycle/synthesize-stubs.mjs
 *
 * Zero-Token Scaffolding Synthesizer.
 *
 * Parsea mecánicamente `design.md` y `spec.md` para generar los stubs de
 * producción y las suites de test que fallan —la fase RED de TDD— sin gastar un
 * token de inferencia: el texto del andamiaje lo emite este archivo, no el
 * modelo.
 *
 * El encabezado afirmaba "eliminating 70-85% of expensive output token
 * generation during /sdd-apply" y ese número no está respaldado por ninguna
 * medición del repositorio —se buscó y no existe—. Lo verificable es la
 * garantía en su forma fuerte, que además es mejor: el agente emite **0**
 * tokens por el andamiaje. Cuánto pesa eso en la fase lo mide
 * `sdd-stress-suite.mjs`, y ese número es del ciclo entero, no de esta
 * herramienta: presentarlos como lo mismo es lo que hacía creíble al 70-85%.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/**
 * El patrón de una declaración de función exportada.
 *
 * Uno solo para las dos mitades del andamiaje. Estaban escritas por separado y
 * divergieron en lo único que no podían permitirse: el stub usaba el nombre real
 * y el test el default `handler`. Compartiendo el patrón, la divergencia deja de
 * ser posible — un cambio en cómo se reconoce una declaración mueve las dos.
 */
const FUNCTION_DECL = /export function ([A-Za-z0-9_$]+)\(([^)]*)\)(?::\s*([^{;\n]+))?;?/g

/**
 * Extracts TypeScript type and interface blocks from design.md.
 * @param {string} designMd 
 * @returns {string[]}
 */
export function extractTypeContracts(designMd = '') {
  if (!designMd) return []
  const matches = designMd.match(/```(?:typescript|ts)\n([\s\S]*?)```/g) || []
  return matches.map(m => m.replace(/```(?:typescript|ts)\n/, '').replace(/```$/, '').trim())
}

/**
 * Extracts Gherkin scenarios or acceptance criteria from spec.md.
 * @param {string} specMd 
 * @returns {Array<{ title: string, steps: string[] }>}
 */
export function extractScenarios(specMd = '') {
  if (!specMd) return []
  const scenarios = []
  const scenarioBlocks = specMd.split(/(?=^###?\s*(?:Scenario|Criterion|Rule):?)/mi)

  for (const block of scenarioBlocks) {
    const trimmed = block.trim()
    if (!trimmed) continue
    const firstLine = trimmed.split('\n')[0]
    if (!/Scenario|Criterion|Rule/i.test(firstLine)) continue

    const title = firstLine.replace(/^#+\s*/, '').replace(/^Scenario:?\s*/i, '').trim()
    const steps = trimmed
      .split('\n')
      .slice(1)
      .map(l => l.trim())
      .filter(l => /^(?:Given|When|Then|And|But)\b/i.test(l))

    scenarios.push({ title, steps })
  }

  return scenarios
}

/**
 * Synthesizes test code from scenarios and contract function names.
 * @param {object} params
 * @param {string} params.functionName
 * @param {string} params.importPath
 * @param {Array<{ title: string, steps: string[] }>} params.scenarios
 * @returns {string}
 */
export function synthesizeTestSuite({ functionName = 'handler', importPath = './handler', scenarios = [] }) {
  const lines = [
    `import { describe, it, expect } from 'vitest'`,
    `import { ${functionName} } from '${importPath}'`,
    ``,
    `describe('${functionName}', () => {`,
  ]

  if (scenarios.length === 0) {
    lines.push(`  it('should be defined and implemented', () => {`)
    lines.push(`    expect(typeof ${functionName}).toBe('function')`)
    lines.push(`    expect(() => ${functionName}()).not.toThrow()`)
    lines.push(`  })`)
  } else {
    for (const sc of scenarios) {
      const cleanTitle = sc.title.replace(/'/g, "\\'")
      lines.push(`  it('${cleanTitle}', () => {`)
      for (const step of sc.steps) {
        lines.push(`    // ${step}`)
      }
      lines.push(`    // TDD Red: Stub initially throws until implemented`)
      lines.push(`    expect(() => ${functionName}()).not.toThrow()`)
      lines.push(`  })`)
    }
  }

  lines.push(`})`)
  lines.push(``)
  return lines.join('\n')
}

/**
 * Synthesizes implementation stub file from extracted TypeScript contracts.
 * @param {string[]} contracts
 * @returns {string}
 */
export function synthesizeImplementationStub(contracts = []) {
  const content = contracts.join('\n\n')
  // For any function declarations, append a failing stub body
  const stubbed = content.replace(FUNCTION_DECL, (match, fnName, args, returnType) => {
    const typeAnno = returnType ? `: ${returnType.trim()}` : ''
    return `export function ${fnName}(${args})${typeAnno} {\n  throw new Error('Not implemented: ${fnName}')\n}`
  })

  return stubbed + '\n'
}

/**
 * Los nombres que los bloques de contrato declaran.
 *
 * Existe porque el andamiaje salía desconectado de sí mismo: el stub definía
 * `evaluateFiberHealth` y `resetMetrics`, y el test importaba `handler` de
 * `./handler` —un símbolo y una ruta que no existen—, porque
 * `scaffoldTaskFromSpecs` llamaba a `synthesizeTestSuite` sin pasarle nunca el
 * nombre. El default (`handler`) tapaba el hueco: el test RED no podía pasar
 * por la razón correcta, y el agente recibía un import inventado.
 *
 * @param {string[]} contracts
 * @returns {string[]}
 */
export function declaredFunctions(contracts = []) {
  const names = []
  for (const block of contracts) {
    for (const m of block.matchAll(FUNCTION_DECL)) {
      if (!names.includes(m[1])) names.push(m[1])
    }
  }
  return names
}

/**
 * Synthesizes the stub and test CONTENT for a task directory.
 *
 * Devuelve contenido, no rutas, y **no escribe nada**: quien llama decide dónde
 * cae. El docblock declaró durante mucho tiempo `{ stubPath, testPath,
 * contractsFound, scenariosFound }` y ninguno de los cuatro campos existía. La
 * promesa falsa y la ausencia de CLI son el mismo defecto visto desde dos lados:
 * como no había punto de entrada, nadie podía contrastar el contrato contra la
 * realidad, y la firma sobrevivió describiendo un archivo que ya no era.
 *
 * `importPath` se recibe y no se deriva: `design.md` declara las firmas, nunca
 * dónde viven, así que adivinarla sería inventar la ruta que este mismo arreglo
 * vino a eliminar.
 *
 * @param {string} taskDir
 * @param {{ importPath?: string }} [opts]
 * @returns {{ contracts: string[], scenarios: Array<{ title: string, steps: string[] }>, implementationStub: string, testSuite: string }}
 */
export function scaffoldTaskFromSpecs(taskDir, { importPath = './<module>' } = {}) {
  const designPath = path.join(taskDir, 'design.md')
  const specPath = path.join(taskDir, 'spec.md')

  const designMd = fs.existsSync(designPath) ? fs.readFileSync(designPath, 'utf8') : ''
  const specMd = fs.existsSync(specPath) ? fs.readFileSync(specPath, 'utf8') : ''

  const contracts = extractTypeContracts(designMd)
  const scenarios = extractScenarios(specMd)

  // Un bloque por función declarada: el andamiaje tiene que cubrir todo lo que
  // el contrato declara, porque el subagente sólo escribe los cuerpos. Sin
  // funciones declaradas se conserva el caso anterior (un bloque genérico), así
  // que un diseño sin contratos no cambia de comportamiento.
  const names = declaredFunctions(contracts)
  const testSuite =
    names.length === 0
      ? synthesizeTestSuite({ importPath, scenarios })
      : names.map((functionName) => synthesizeTestSuite({ functionName, importPath, scenarios })).join('\n')

  return {
    contracts,
    scenarios,
    implementationStub: synthesizeImplementationStub(contracts),
    testSuite
  }
}

/**
 * El reporte que imprime el CLI. Puro, para poder fijarlo con una entrada.
 *
 * Imprime en vez de escribir, y ésa es la decisión que hace seguro al CLI. El
 * contenido es mecánico, pero DÓNDE cae es del Owner: una herramienta que crea
 * archivos en el workspace necesita una política de sobrescritura que nadie
 * pidió, y sobrescribir un test existente destruye trabajo. El agente lee los
 * dos bloques y los escribe él.
 */
export function formatScaffoldReport(taskDir, opts = {}) {
  const { contracts, scenarios, implementationStub, testSuite } = scaffoldTaskFromSpecs(taskDir, opts)
  return [
    '=== AOI Zero-Token Scaffolding ===',
    '',
    `Contratos:  ${contracts.length}`,
    `Escenarios: ${scenarios.length}`,
    '',
    '--- implementationStub ---',
    implementationStub.trimEnd(),
    '',
    '--- testSuite ---',
    testSuite.trimEnd(),
    '',
    'Nada escrito: esta salida es para que la escribas vos.',
  ].join('\n')
}

/**
 * El punto de entrada que faltaba.
 *
 * La prosa de `/sdd-apply` invoca esta ruta desde hace tiempo y la invocación no
 * producía NADA: el módulo exportaba una librería y no tenía `main`, así que
 * `node synthesize-stubs.mjs` salía 0 en silencio y `aoi:tools` —que mide
 * invocación, no mención— quedaba satisfecho por la línea de prosa. El
 * `fileURLToPath` importado y sin usar era el rastro de este `main` que nunca se
 * escribió.
 */
export function main(argv = process.argv.slice(2)) {
  const value = (flag) => {
    const at = argv.indexOf(flag)
    const next = at > -1 ? argv[at + 1] : undefined
    // Un flag seguido de otro flag, o al final, no tiene valor: se trata como
    // ausente en vez de tomar el flag como path.
    return next === undefined || next.startsWith('--') ? undefined : next
  }

  const taskDir = value('--task-dir')
  if (!taskDir) {
    process.stderr.write(
      'uso: node scripts/sdd-lifecycle/synthesize-stubs.mjs --task-dir <dir> [--import-path <p>]\n'
    )
    process.exitCode = 1
    return
  }
  if (!fs.existsSync(taskDir)) {
    process.stderr.write(`[synthesize-stubs] no existe el directorio de tarea: ${taskDir}\n`)
    process.exitCode = 1
    return
  }

  const importPath = value('--import-path')
  process.stdout.write(`${formatScaffoldReport(taskDir, importPath ? { importPath } : {})}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
