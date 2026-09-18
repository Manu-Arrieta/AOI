/**
 * scripts/scaffold/installed-suite.test.mjs
 *
 * La corrida real cuesta una instalación y un `pnpm install`, así que acá se
 * fija la FORMA del plan y la decisión ante un fallo, con el ejecutor
 * inyectado. Lo que se prueba es que la compuerta corre lo que dice correr y
 * que un paso rojo la pone roja — no se prueba de nuevo el instalador, que ya
 * tiene once suites propias.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { makeWorkDir, planInstalledSuite, runInstalledSuite } from './installed-suite.mjs'

const REPO = '/repo'
const WORK = '/work'

describe('el plan corre el instalador y después la suite del producto instalado', () => {
  const plan = planInstalledSuite(REPO, WORK)

  it('son tres pasos, en el único orden que tiene sentido', () => {
    assert.deepEqual(
      plan.map((p) => p.label),
      ['install', 'deps', 'suite']
    )
  })

  it('el primer paso ejecuta el setup.sh del REPOSITORIO sobre el destino', () => {
    assert.equal(plan[0].command, 'bash')
    assert.equal(plan[0].args[0], path.join(REPO, 'setup.sh'))
    assert.ok(plan[0].args.includes(WORK), 'el destino tiene que ser el directorio de trabajo')
  })

  it('la suite corre DENTRO de la instalación, no en el repositorio', () => {
    // El defecto que esta compuerta existe para cazar sólo se manifiesta en el
    // árbol instalado. Correr `pnpm test` con cwd en el repo mediría justo el
    // lado que ya estaba verde y la compuerta no serviría para nada.
    const suite = plan.find((p) => p.label === 'suite')
    assert.equal(suite.cwd, WORK)
    assert.deepEqual(suite.args, ['test'])
  })

  it('nunca usa shell, así que un destino con espacios no se parte en dos', () => {
    // `/Users/.../AOI TESTS` y `/tmp/AOI VERIFY` llevan espacio. Con `shell:true`
    // el destino llegaría como dos argumentos y el instalador escribiría en el
    // lugar equivocado.
    for (const step of planInstalledSuite('/r p', '/w d')) {
      assert.ok(Array.isArray(step.args), `${step.label} tiene que pasar argv, no una cadena`)
    }
  })
})

describe('un paso rojo pone roja a la compuerta', () => {
  const okRun = () => ({ status: 0 })

  it('pasa cuando los tres pasos salen 0', () => {
    const r = runInstalledSuite({ repoRoot: REPO, workDir: WORK, run: okRun })
    assert.equal(r.ok, true)
    assert.equal(r.failed, null)
    assert.equal(r.resultados.length, 3)
  })

  // El control negativo, y el caso que motivó el archivo: `pnpm test` salía 1
  // dentro de la instalación mientras el repositorio estaba verde.
  it('reporta CUÁL paso falló, no sólo que algo falló', () => {
    const run = (step) => ({ status: step.label === 'suite' ? 1 : 0 })
    const r = runInstalledSuite({ repoRoot: REPO, workDir: WORK, run })
    assert.equal(r.ok, false)
    assert.equal(r.failed, 'suite')
  })

  it('corta en el primer fallo en vez de encadenar un error derivado', () => {
    // Sin instalación no hay nada que testear: dejar correr `pnpm install` y
    // `pnpm test` sobre un directorio vacío produce un segundo error que tapa
    // el primero y manda a depurar el lugar equivocado.
    const vistos = []
    const run = (step) => {
      vistos.push(step.label)
      return { status: step.label === 'install' ? 1 : 0 }
    }
    const r = runInstalledSuite({ repoRoot: REPO, workDir: WORK, run })
    assert.equal(r.failed, 'install')
    assert.deepEqual(vistos, ['install'], 'no debió intentar nada después del fallo')
  })
})

describe('el directorio de trabajo vive fuera del repositorio', () => {
  it('se crea bajo el temporal del sistema y es propio de cada corrida', () => {
    // Dentro del repo, `pnpm install` engancharía el workspace de AOI y la
    // corrida dejaría de medir una instalación aislada.
    const a = makeWorkDir('aoi-test-')
    const b = makeWorkDir('aoi-test-')
    try {
      assert.notEqual(a, b, 'dos corridas no pueden compartir destino')
      for (const d of [a, b]) {
        assert.ok(fs.existsSync(d))
        assert.ok(!path.resolve(d).startsWith(path.resolve(process.cwd())))
      }
    } finally {
      for (const d of [a, b]) fs.rmSync(d, { recursive: true, force: true })
    }
  })
})
