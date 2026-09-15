/**
 * scripts/doctor-checks.test.mjs
 *
 * The six questions the diagnostic asks, each one answered against a
 * workspace built to make it answer wrong.
 *
 * `scripts/` measured 27% by mutation — the worst score in the repository.
 * These two checks ask about the machine: whether a binary is there, and
 * whether ICM says it is healthy. The survivors were in the distinction
 * between a mandatory and an optional tool, and in what output counts as
 * healthy. Both decide whether the Owner gets told something.
 *
 * The four checks that read the workspace itself live in
 * `doctor-state-checks.test.mjs`.
 *
 * Los chequeos de Archify se sumaron acá —y no sólo en
 * `scripts/conf/archify-candidate-parity.test.mjs`— porque el área `scripts`
 * muta los `.mjs` de la raíz y corre `scripts/*.test.mjs`: un test que vive en
 * `scripts/conf/` no mata ni un mutante de `archify-checks.mjs`. Medido: al
 * extraer esas funciones de `doctor-checks.mjs` el área cayó de 81% a 78% por
 * exactamente eso. La paridad con los instaladores sigue en `conf`; acá se fija
 * el contrato de la detección.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  checkArchifySkill,
  checkBinaries,
  checkIcmHealth,
  findArchifyRenderer,
  MANDATORY_BINARIES,
  RECOMMENDED_BINARIES,
} from './doctor-checks.mjs'
import { ARCHIFY_RENDERER_CANDIDATES } from './archify-checks.mjs'

describe('checkBinaries separates what blocks from what merely warns', () => {
  const found = async () => ({ stdout: '/usr/local/bin/x\n', stderr: '' })
  const absent = async () => {
    throw new Error('not found')
  }

  it('reports a present binary with the path it resolved to', async () => {
    const [r] = await checkBinaries([{ name: 'icm', description: 'x' }], found)
    assert.equal(r.status, 'PASSED')
    assert.equal(r.details, '/usr/local/bin/x')
  })

  it('takes only the FIRST line when `which` reports several', async () => {
    // A second entry on PATH is not a second answer; recording the whole blob
    // as "the path" would put a newline into the report.
    const many = async () => ({ stdout: '/opt/bin/icm\n/usr/local/bin/icm\n', stderr: '' })
    const [r] = await checkBinaries([{ name: 'icm', description: 'x' }], many)
    assert.equal(r.details, '/opt/bin/icm')
  })

  it('FAILS on an absent mandatory binary', async () => {
    const [r] = await checkBinaries([{ name: 'icm', description: 'x' }], absent)
    assert.equal(r.status, 'FAILED')
    assert.equal(r.mandatory, true)
  })

  it('only WARNS on an absent optional one', async () => {
    // The difference is the entire point of the two lists: a workspace
    // without headroom is usable, one without ICM is not.
    const [r] = await checkBinaries([{ name: 'headroom', description: 'x' }], absent)
    assert.equal(r.status, 'WARNING')
    assert.equal(r.mandatory, false)
  })

  it('decides mandatory by the shipped list, not by position in the argument', async () => {
    const results = await checkBinaries(
      [{ name: 'headroom', description: 'x' }, { name: 'icm', description: 'y' }],
      absent
    )
    assert.deepEqual(results.map((r) => r.mandatory), [false, true])
  })

  it('treats an unknown binary as optional rather than blocking', async () => {
    const [r] = await checkBinaries([{ name: 'inventado', description: 'x' }], absent)
    assert.equal(r.mandatory, false)
    assert.equal(r.status, 'WARNING')
  })

  it('ships ICM as the only mandatory tool, per the Owner', () => {
    assert.deepEqual(MANDATORY_BINARIES.map((b) => b.name), ['icm'])
    assert.ok(RECOMMENDED_BINARIES.some((b) => b.name === 'headroom'))
  })
})

/** Un HOME temporal, borrado al cerrar el test. */
function tempHome(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-doctor-archify-'))
  t.after(() => fs.rmSync(home, { recursive: true, force: true }))
  return home
}

/** Escribe un renderizador en `rel`, debajo de `home`. */
function plant(home, rel) {
  const abs = path.join(home, rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, '// renderer\n')
  return abs
}

describe('findArchifyRenderer localiza el renderizador por la ruta, no por el PATH', () => {
  it('devuelve la ruta absoluta de la primera candidata presente', (t) => {
    const home = tempHome(t)
    const expected = plant(home, ARCHIFY_RENDERER_CANDIDATES[0])
    assert.equal(findArchifyRenderer(home), expected)
  })

  it('encuentra cada una de las cuatro, una por vez', (t) => {
    // Una por una y no todas juntas: con todas presentes, tres de las cuatro
    // rutas podrian estar mal escritas y el test pasaria igual.
    for (const rel of ARCHIFY_RENDERER_CANDIDATES) {
      const home = tempHome(t)
      const expected = plant(home, rel)
      assert.equal(findArchifyRenderer(home), expected, `no encontro ${rel}`)
    }
  })

  it('respeta la precedencia: la primera gana cuando hay varias', (t) => {
    const home = tempHome(t)
    for (const rel of ARCHIFY_RENDERER_CANDIDATES) plant(home, rel)
    assert.equal(findArchifyRenderer(home), path.join(home, ARCHIFY_RENDERER_CANDIDATES[0]))
  })

  it('devuelve cadena vacía cuando no está, en vez de inventar una ruta', (t) => {
    // Devolver la candidata descartada convertiría una ausencia en un
    // veredicto positivo, y el doctor diría PASSED sin renderizador.
    assert.equal(findArchifyRenderer(tempHome(t)), '')
  })
})

describe('checkArchifySkill degrada a WARNING en vez de bloquear', () => {
  it('PASSED con la ruta cuando el renderizador existe', (t) => {
    const home = tempHome(t)
    const expected = plant(home, ARCHIFY_RENDERER_CANDIDATES[0])
    const result = checkArchifySkill(home)
    assert.equal(result.status, 'PASSED')
    assert.equal(result.details, expected)
  })

  it('WARNING —nunca FAILED— y dice cómo instalarlo', (t) => {
    // Archify es una skill de terceros, no un binario de AOI: su ausencia
    // degrada una compuerta opcional, no rompe el sistema.
    const result = checkArchifySkill(tempHome(t))
    assert.equal(result.status, 'WARNING')
    assert.match(result.details, /install-archify\.sh/)
  })
})

describe('el doctor le pregunta al sistema en el vocabulario del sistema', () => {
  it('usa `which` fuera de Windows y `where` dentro', async () => {
    const calls = []
    const spy = async (cmd, args) => {
      calls.push([cmd, ...args])
      return { stdout: '/usr/local/bin/icm\n', stderr: '' }
    }
    await checkBinaries([{ name: 'icm', description: 'x' }], spy)

    // La expectativa se calcula acá, en el test, y no se importa: el archivo de
    // test no se muta, así que si el ternario de la fuente se invierte, la
    // fuente pregunta por `where` en macOS mientras esta línea espera `which`.
    const expected = process.platform === 'win32' ? 'where' : 'which'
    assert.equal(calls[0][0], expected)
    assert.equal(calls[0][1], 'icm')
  })
})

describe('checkIcmHealth nombra la última línea, y tiene respaldo', () => {
  const withStdout = (stdout) => async () => ({ stdout, stderr: '' })

  it('reporta la última línea de la salida de `icm doctor`', async () => {
    const r = await checkIcmHealth(withStdout('Database integrity: ok\nAll hooks healthy'))
    assert.equal(r.status, 'PASSED')
    assert.equal(r.details, 'All hooks healthy')
  })

  it('cae al respaldo cuando la salida sólo trae espacios', async () => {
    // `trim()` deja la cadena vacía, `split` devuelve [''], y `pop()` es falsy.
    // Sin el `||` el reporte saldría con un `details` vacío, que en el resumen
    // se lee como un chequeo que no diagnosticó nada.
    const r = await checkIcmHealth(withStdout('   \n  '))
    assert.equal(r.details, 'ICM doctor check complete')
  })
})

describe('checkIcmHealth reads the output, not merely the exit code', () => {
  const saying = (stdout) => async () => ({ stdout, stderr: '' })

  it('accepts either wording ICM uses for a healthy database', async () => {
    for (const text of ['everything healthy\n', 'Database integrity: ok\n']) {
      assert.equal((await checkIcmHealth(saying(text))).status, 'PASSED', text)
    }
  })

  it('does NOT accept output that says neither', async () => {
    // A command that exits 0 having printed nothing useful is not evidence
    // of health, and reading it as such is how a corrupt store passes.
    assert.equal((await checkIcmHealth(saying('done\n'))).status, 'WARNING')
  })

  it('refuses a healthy claim that also reports an error or corruption', async () => {
    // Both negations must hold: "healthy" plus "error" is not healthy.
    for (const text of ['healthy but error found\n', 'Database integrity: ok\ncorrupt index\n']) {
      assert.equal((await checkIcmHealth(saying(text))).status, 'WARNING', text)
    }
  })

  it('FAILS, not warns, when icm cannot be executed at all', async () => {
    const broken = async () => {
      throw new Error('spawn icm ENOENT')
    }
    const r = await checkIcmHealth(broken)
    assert.equal(r.status, 'FAILED')
    assert.match(r.details, /ENOENT/)
  })
})
