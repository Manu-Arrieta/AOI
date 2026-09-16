/**
 * scripts/multi-harness/merge-package-scripts.test.mjs
 *
 * Instalar AOI en un proyecto que ya existe es su caso de uso principal, y el
 * instalador lo resolvía pisando package.json entero. Reproducido: el nombre
 * de un proyecto pasó de "el-proyecto-del-owner" a "aoi-workspace", llevándose
 * versión, dependencias y scripts.
 *
 * Proteger el archivo creó el problema opuesto — las compuertas de AOI SON
 * scripts de npm, así que sin ellas el workspace tiene los archivos y ninguno
 * de los comandos. De ahí que se fusione en vez de reemplazar, y que la fusión
 * sea deliberadamente tímida.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mergeScripts } from './merge-package-scripts.mjs'

const scaffold = {
  name: 'aoi-workspace',
  version: '0.0.0',
  scripts: { test: 'pnpm aoi:srp && vitest', 'aoi:doctor': 'node d.mjs', 'sync:rules': 'node s.mjs', build: 'nuxt build' },
}

describe('la identidad del proyecto no es asunto de AOI', () => {
  it('no toca nombre, versión ni dependencias', () => {
    const owner = { name: 'mio', version: '3.2.1', dependencies: { vue: '^3' }, scripts: {} }

    const { manifest } = mergeScripts(owner, scaffold)

    assert.equal(manifest.name, 'mio')
    assert.equal(manifest.version, '3.2.1')
    assert.deepEqual(manifest.dependencies, { vue: '^3' })
  })

  it('ignora scripts del scaffold que no son de AOI', () => {
    // `build` es del andamio de ejemplo, no una compuerta. Meterlo en el
    // proyecto de otro sería opinar sobre cómo compila.
    const { manifest } = mergeScripts({ scripts: {} }, scaffold)
    assert.equal(manifest.scripts.build, undefined)
  })
})

describe('las compuertas de AOI llegan, sin desplazar las del Owner', () => {
  it('agrega los scripts que faltan', () => {
    const { manifest, added } = mergeScripts({ scripts: { dev: 'vite' } }, scaffold)

    assert.equal(manifest.scripts['aoi:doctor'], 'node d.mjs')
    assert.equal(manifest.scripts.dev, 'vite', 'perdió un script del Owner')
    assert.ok(added.includes('aoi:doctor'))
  })

  it('trae la familia entera del dashboard, no sólo el test', () => {
    // `test:dashboard` llegaba por el prefijo `test` y era el ÚNICO que
    // llegaba: el proyecto recibía con qué testear el dashboard y nada con qué
    // levantarlo ni construirlo. Medido en una instalación real, no supuesto.
    const dash = {
      scripts: {
        'dev:dashboard': 'cd aoi_apps/agentic-ops-dashboard && pnpm run dev',
        'build:dashboard': 'cd aoi_apps/agentic-ops-dashboard && pnpm run build',
        'preview:dashboard': 'cd aoi_apps/agentic-ops-dashboard && pnpm run preview',
        'test:dashboard': 'cd aoi_apps/agentic-ops-dashboard && pnpm run prepare && pnpm run test',
        'prepare:dashboard': 'cd aoi_apps/agentic-ops-dashboard && pnpm run prepare',
      },
    }

    const { manifest, added } = mergeScripts({ scripts: { dev: 'vite' } }, dash)

    for (const [name, body] of Object.entries(dash.scripts)) {
      assert.equal(manifest.scripts[name], body, `faltó ${name}`)
    }
    assert.equal(added.length, 5)
    assert.equal(manifest.scripts.dev, 'vite', 'perdió un script del Owner')
  })

  it('no inyecta scripts del dashboard en Core ni Advanced', () => {
    const dash = {
      scripts: {
        'dev:dashboard': 'pnpm run dev',
        'test:dashboard': 'pnpm run test',
        'aoi:doctor': 'node d.mjs',
      },
    }

    for (const profile of ['core', 'advanced']) {
      const { manifest, added } = mergeScripts({ scripts: {} }, dash, { profile })
      assert.equal(manifest.scripts['dev:dashboard'], undefined, `${profile} recibió una app que no seleccionó`)
      assert.equal(manifest.scripts['test:dashboard'], undefined, `${profile} recibió un test que no puede ejecutar`)
      assert.deepEqual(added, ['aoi:doctor'])
    }
  })

  it('NUNCA pisa un script que el Owner ya define', () => {
    // Un `pnpm test` que deja de correr su suite es peor falla que una
    // compuerta ausente: rompe lo que ya funcionaba.
    const { manifest, renamed } = mergeScripts({ scripts: { test: 'jest' } }, scaffold)

    assert.equal(manifest.scripts.test, 'jest', 'pisó el test del Owner')
    assert.equal(manifest.scripts['aoi:test'], 'pnpm aoi:srp && vitest')
    assert.deepEqual(renamed, [['test', 'aoi:test']])
  })

  it('no duplica cuando el script ya es idéntico', () => {
    const { added, renamed, untouched } = mergeScripts({ scripts: { 'aoi:doctor': 'node d.mjs' } }, scaffold)

    assert.ok(!added.includes('aoi:doctor'))
    assert.deepEqual(renamed.filter(([n]) => n === 'aoi:doctor'), [])
    assert.ok(untouched.includes('aoi:doctor'))
  })

  it('no pisa un alias que el Owner ya ocupó', () => {
    const owner = { scripts: { test: 'jest', 'aoi:test': 'algo mío' } }

    const { manifest } = mergeScripts(owner, scaffold)

    assert.equal(manifest.scripts['aoi:test'], 'algo mío', 'pisó un alias ocupado')
  })

  it('funciona sobre un manifest sin scripts en absoluto', () => {
    const { manifest } = mergeScripts({ name: 'x' }, scaffold)
    assert.ok(manifest.scripts['aoi:doctor'])
  })
})
