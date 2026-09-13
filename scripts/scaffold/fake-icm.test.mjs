/**
 * scripts/scaffold/fake-icm.test.mjs
 *
 * El `icm` de mentira, probado corriéndolo.
 *
 * Por qué un test para un stub, que a primera vista es andamiaje: porque **su
 * fidelidad es lo único que hace válidos a los tests que lo usan**. Si el stub
 * deja de emitir el formato que el parser real espera, los dos tests de
 * `memory-sync` y el de `sdd-lifecycle` siguen pasando y dejan de probar lo que
 * dicen. Un stub sin test es una promesa; uno con test es un contrato.
 *
 * Y hay una razón más concreta: al agregarlo, `scripts/scaffold` bajó de 61% a
 * 60% en el trinquete de mutación —dos mutantes más, dos supervivientes más— y
 * el trinquete lo rechazó por un punto. Ése es exactamente el comportamiento que
 * se busca: código nuevo sin test que lo ate baja el score del área, y el
 * trinquete no deja pasar la caída. Este archivo es la respuesta a eso.
 *
 * Lo que se afirma es la COMPATIBILIDAD con el parser de producción, no sólo la
 * forma: los bloques se parten y se leen con las mismas expresiones que usa
 * `export-memory-bundle.mjs`, así que un cambio de formato en el stub rompe acá.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

import { fakeIcm, removeFakeIcm } from './fake-icm.mjs'

/** Corre el stub y devuelve exit code, stdout y stderr. */
function runStub(icmPath, args) {
  try {
    const stdout = execFileSync('icm', args, {
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH: icmPath },
    })
    return { code: 0, stdout, stderr: '' }
  } catch (e) {
    return { code: e.status ?? 1, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') }
  }
}

describe('el icm de mentira responde como el real', () => {
  it('devuelve un bloque por topic, con el formato que el parser espera', () => {
    const icm = fakeIcm({ topics: ['ws-context', 'otro-context'] })
    try {
      const r = runStub(icm.path, ['list', '--all', '--no-embeddings'])
      assert.equal(r.code, 0)

      // Se parte y se lee con las MISMAS expresiones que el productor usa, que
      // es lo que hace válido al stub: si deja de ser compatible, esto falla.
      const bloques = r.stdout.trim().split(/\n(?=--- )/)
      assert.equal(bloques.length, 2, 'un bloque por topic')
      assert.match(bloques[0], /^\s*topic:\s+ws-context$/m)
      assert.match(bloques[1], /^\s*topic:\s+otro-context$/m)
    } finally {
      removeFakeIcm(icm.dir)
    }
  })

  it('sin topics devuelve vacío, no una lista inventada', () => {
    // El caso importa: un stub que siempre devolviera un topic haría que el test
    // del aislamiento pase sin probar el filtro.
    const icm = fakeIcm()
    try {
      const r = runStub(icm.path, ['list', '--all'])
      assert.equal(r.code, 0)
      assert.equal(r.stdout, '')
    } finally {
      removeFakeIcm(icm.dir)
    }
  })

  it('contesta `no facts for <entidad>` con exit 0, que es como dice que no la conoce', () => {
    const icm = fakeIcm()
    try {
      const r = runStub(icm.path, ['facts', 'list', 'entidad-inexistente', '--read-only'])
      assert.equal(r.code, 0, 'icm no usa códigos de salida para esto')
      assert.equal(r.stdout, 'no facts for entidad-inexistente\n')
    } finally {
      removeFakeIcm(icm.dir)
    }
  })

  it('sale 1 en un subcomando que no emula, en vez de inventar una respuesta', () => {
    // Un stub que contestara cualquier cosa escondería un uso no previsto del
    // binario: mejor que el test falle que un resultado falso pase.
    const icm = fakeIcm({ topics: ['ws-context'] })
    try {
      const r = runStub(icm.path, ['wake-up'])
      assert.equal(r.code, 1)
    } finally {
      removeFakeIcm(icm.dir)
    }
  })

  it('el PATH que devuelve antepone el stub y conserva el original', () => {
    const icm = fakeIcm()
    try {
      assert.equal(icm.path.startsWith(`${icm.dir}${path.delimiter}`), true)
      assert.equal(icm.path.endsWith(process.env.PATH), true)
    } finally {
      removeFakeIcm(icm.dir)
    }
  })

  it('removeFakeIcm borra el directorio, para no dejar basura en el temporal', () => {
    const icm = fakeIcm({ topics: ['x'] })
    assert.equal(fs.existsSync(icm.dir), true)
    removeFakeIcm(icm.dir)
    assert.equal(fs.existsSync(icm.dir), false)
  })
})
