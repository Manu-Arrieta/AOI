/**
 * scripts/sdd-lifecycle/invariant-gate-blocks.test.mjs
 *
 * Las formas de entrada que el gate tiene que BLOQUEAR, y que antes aprobaban.
 *
 * Nacieron de una verificación adversarial que ejecutó el gate contra entradas
 * que un auditor no prueba. Encontró cinco caminos hacia `SKIPPED`/`PASSED` con
 * exit 0, y acá quedan fijados los cuatro que viven en este módulo:
 *
 *   1. `--facts-file` con una tabla que el parser no entiende —separada por tabs,
 *      o en formato `key: value`— porque todos los `continue` de `parseFactTable`
 *      son silenciosos: *no pude parsear* se reportaba como *no hay contrato*.
 *   2. `--bic` con typo, que hacía decir al gate "No BIC contract facts found"
 *      sobre un contrato que SÍ tenía hechos. Mensaje falso y exit 0.
 *   3. Y el peor: la guardia se evaluaba sobre el conjunto SIN filtrar, así que
 *      **un argumento de más apagaba el fail-closed**. Agregar `--bic <typo>`
 *      desactivaba la única comprobación de que había leído algo.
 *
 * Están en un archivo propio y no en `gate-cli-surface.test.mjs` porque ese
 * estaba a cuatro líneas del límite de 300 del Invariante 5.
 *
 * Split estricto/laxo: el caso de `SKIPPED` legítimo también se fija acá, porque
 * una guardia que bloquea de más rompe el ciclo y se desactiva igual que una que
 * bloquea de menos.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, describe, it } from 'node:test'

const GATE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'invariant-gate.mjs')

const SANDBOXES = []

after(() => {
  for (const dir of SANDBOXES) fs.rmSync(dir, { recursive: true, force: true })
})

/** Un workspace descartable con tests y los archivos de hechos que se pidan. */
function workspace(facts) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-gate-blocks-'))
  SANDBOXES.push(root)
  fs.mkdirSync(path.join(root, 'tests'), { recursive: true })
  fs.writeFileSync(path.join(root, 'tests/a.test.mjs'), 'import {test} from "node:test"\ntest("x",()=>{})\n')
  // Un `package.json` que colecta los tests, para que estos casos midan lo que
  // dicen medir. Sin él, la alcanzabilidad es indeterminada y el gate bloquea por
  // ESA razón —ver el describe de abajo— y no por la entrada que cada caso prueba.
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node --test tests/*.test.mjs' } }))
  for (const [name, body] of Object.entries(facts)) fs.writeFileSync(path.join(root, name), body)
  return root
}

/** Corre el gate y devuelve su exit code, nunca a través de un pipe. */
function exitCode(root, args) {
  // `--tests-dir` es la RAÍZ del árbol, no la carpeta de tests, y no es un
  // detalle del fixture: la alcanzabilidad se responde leyendo el `package.json`
  // del repo, así que si se le pasa un subdirectorio la pregunta se hace en un
  // lugar donde la respuesta no está. Es la forma documentada de invocar el gate
  // (`--tests-dir .` desde el árbol que se audita) y los tests viven en `tests/`,
  // que el glob del `package.json` cubre.
  try {
    execFileSync('node', [GATE, ...args, '--tests-dir', root, '--exit-code'], {
      cwd: root,
      stdio: 'ignore',
      timeout: 60000,
    })
    return 0
  } catch (e) {
    return e.status ?? 1
  }
}

const UNA_REGLA = 'bic.T1.never.1  El precio nunca baja\n'
const SOLO_NO_BIC = 'key   value\n-----\ntask.X.status  archived\n'

describe('una entrada que no se pudo leer NO es un contrato vacío', () => {
  it('bloquea si la tabla viene separada por tabs', () => {
    const root = workspace({ 'tabs.txt': 'bic.T1.never.1\tEl precio nunca baja\n' })
    assert.equal(exitCode(root, ['--facts-file', 'tabs.txt']), 2, 'un formato distinto al del parser pasó como "sin contrato"')
  })

  it('bloquea si la tabla no tiene forma de tabla', () => {
    const root = workspace({ 'basura.txt': 'texto suelto que no es una tabla\n' })
    assert.equal(exitCode(root, ['--facts-file', 'basura.txt']), 2)
  })

  it('bloquea si el archivo de hechos está vacío de contenido útil', () => {
    const root = workspace({ 'vacio.txt': '   \n\n' })
    // Vacío de verdad no llega a la guardia de parseo: el contrato está vacío y
    // sin entidad inferida eso es el SKIPPED documentado. Lo que se fija acá es
    // que NO sea un PASSED.
    assert.notEqual(exitCode(root, ['--facts-file', 'vacio.txt']), 0)
  })
})

describe('un filtro que no matchea nada NO es un contrato vacío', () => {
  it('bloquea con --bic que no existe, en vez de mentir sobre el contrato', () => {
    // El mensaje anterior era "No BIC contract facts found for this workspace",
    // sobre un contrato con una regla. Un mensaje falso manda a buscar el
    // problema donde no está.
    const root = workspace({ 'good.txt': UNA_REGLA })
    assert.equal(exitCode(root, ['--facts-file', 'good.txt', '--bic', 'TYPO-NOPE']), 2)
  })

  it('el filtro no puede APAGAR la guardia de haber leído algo', () => {
    // El defecto más grave de los tres: la guardia se evaluaba antes de filtrar,
    // así que `--bic <typo>` desactivaba el fail-closed. Se prueba que el exit
    // con typo (2) es distinto del de un contrato legítimamente sin cobertura (1),
    // que es la firma de que la guardia ahora sí lo ve.
    const root = workspace({ 'good.txt': UNA_REGLA })
    assert.equal(exitCode(root, ['--facts-file', 'good.txt', '--bic', 'T1']), 1, 'un --bic válido debe llegar al juicio de cobertura')
    assert.equal(exitCode(root, ['--facts-file', 'good.txt', '--bic', 'TYPO']), 2, 'un --bic inválido debe bloquear')
  })
})

describe('lo que NO debe bloquear, porque bloquear de más rompe el ciclo', () => {
  it('un contrato legítimamente sin reglas bic.* sigue dando SKIPPED con 0', () => {
    const root = workspace({ 'nobic.txt': SOLO_NO_BIC })
    assert.equal(exitCode(root, ['--facts-file', 'nobic.txt']), 0)
  })

  it('un contrato con reglas sin cobertura sigue dando FAILED con 1', () => {
    const root = workspace({ 'good.txt': UNA_REGLA })
    assert.equal(exitCode(root, ['--facts-file', 'good.txt']), 1)
  })
})

describe('la alcanzabilidad INDETERMINADA bloquea, no aprueba', () => {
  // El escenario exacto que una verificación adversarial encontró: con un
  // `package.json` que no se puede leer, `dropUnreachableTests` devolvía
  // `kept: sources` —*"no pude determinar"* se leía como *"todo es alcanzable"*—
  // así que un archivo que ningún runner colecta pasaba a ser LA EVIDENCIA de que
  // el contrato está enforced, y el gate daba PASSED.
  //
  // Contradecía la doctrina del propio `test-reachability.mjs`, escrita unas
  // líneas más arriba y aplicada a las specs de vitest y no al `package.json`:
  // *"unresolvable is reported, never assumed reachable"*.
  it('un package.json ilegible da BLOCKED, no PASSED', () => {
    const root = workspace({ 'good.txt': 'bic.T1.never.1  El precio nunca baja\n' })
    fs.writeFileSync(path.join(root, 'package.json'), '{ roto\n')
    assert.equal(exitCode(root, ['--facts-file', 'good.txt']), 2)
  })

  it('y sin package.json tampoco puede certificar cobertura', () => {
    const root = workspace({ 'good.txt': 'bic.T1.never.1  El precio nunca baja\n' })
    fs.rmSync(path.join(root, 'package.json'))
    assert.equal(exitCode(root, ['--facts-file', 'good.txt']), 2)
  })

  it('con el package.json sano, el mismo caso llega al juicio de cobertura', () => {
    // Control: el bloqueo es por la entrada ilegible, no porque el gate se haya
    // vuelto un bloqueo permanente.
    const root = workspace({ 'good.txt': 'bic.T1.never.1  El precio nunca baja\n' })
    assert.equal(exitCode(root, ['--facts-file', 'good.txt']), 1, 'debería ser FAILED por falta de cobertura')
  })
})
