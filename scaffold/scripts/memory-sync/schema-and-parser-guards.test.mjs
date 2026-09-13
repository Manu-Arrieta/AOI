/**
 * scripts/memory-sync/schema-and-parser-guards.test.mjs
 *
 * Las guardias de los módulos que NO son las cinco funciones de ciclo de vida:
 * el validador del manifiesto persistido, el parser de argumentos y el
 * resolvedor de la versión activa.
 *
 * Va aparte de `argument-guards.test.mjs` por un corte real. Ése prueba la
 * validación de lo que un LLAMADOR pasa, con la tabla de campos y mensajes.
 * Éste prueba la validación de un DOCUMENTO que ya existe en disco y de las
 * herramientas de borde, que son dos sujetos distintos con dos formas de
 * entrarles datos.
 *
 * Por qué existe: el área tenía 78 mutantes supervivientes, y 60 eran de
 * operador booleano — `and→or`, `gt→gte`, `or→and` — en guardias que se
 * ejercitaban SÓLO con entrada válida. Una guardia así no está ejercitada.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { exportMemoryBundle } from './export-memory-bundle.mjs'
import { importMemoryBundle } from './import-memory-bundle.mjs'
import { prepareVersionManifest } from './prepare-version-manifest.mjs'
import { validateMemoryVersionManifest } from './schema.mjs'
import { resolveExportArtifactPath } from './store-utils.mjs'
import { parseBundleArgs } from './cli-args.mjs'
import { resolveActiveVersion } from './resolve-active-version.mjs'

const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-guards-schema-'))

/**
 * Argumentos que PASAN todas las guardias, para romper exactamente una.
 *
 * `versionsRoot` apunta a un directorio vacío a propósito: las guardias corren
 * antes de cualquier lectura, así que un caso que llega hasta el I/O es un caso
 * que NO disparó la guardia que decía probar — y queremos que se note.
 */
const BASES = {
  exportMemoryBundle: () => ({
    workspace: 'ws',
    versionId: 'v1',
    relativeArtifactPath: 'a.memory-bundle.json.gz',
    selectedScopes: [],
    versionsRoot: raiz,
    exportedAt: '2026-09-13T00:00:00.000Z',
    loadScopePayload: async () => ({}),
  }),
  importMemoryBundle: () => ({
    workspace: 'ws',
    versionId: 'v1',
    relativeArtifactPath: 'a.memory-bundle.json.gz',
    ownerContext: 'contexto',
    versionsRoot: raiz,
  }),
  prepareVersionManifest: () => ({
    workspace: 'ws',
    versionId: 'v1',
    sourceWorkspace: 'otro',
    sourceVersionId: 'v1',
    ownerContext: 'contexto',
    versionsRoot: raiz,
  }),
}

describe('las mismas guardias del schema, que es función pura', () => {
  // Las del schema SÍ eran alcanzables —`raw` viene de un JSON, no de un
  // ternario— y lo que faltaba era la entrada. Se prueban de frente porque el
  // schema es puro y no necesita ningún fixture.
  const manifiesto = (extra) => ({
    versionId: 'v1',
    workspace: 'ws',
    status: 'candidate',
    previousVersionId: null,
    sourceWorkspace: 'ws',
    sourceVersionId: null,
    selectedScopes: ['memories'],
    ownerContext: 'ctx',
    decisions: { retain: [], complement: [], discard: [] },
    dynamicConstitutionPath: '.specify/memory/versions/constitutions/ws/v1.md',
    createdAt: '2026-09-13T00:00:00.000Z',
    activatedAt: null,
    ...extra,
  })

  it('CONTROL: el manifiesto base valida', () => {
    assert.doesNotThrow(() => validateMemoryVersionManifest(manifiesto({})))
  })

  it('rechaza selectedScopes que no sea un array no vacío', () => {
    // `Array.isArray(x) && x.length > 0`: un string tiene largo y no es array.
    for (const malo of ['memories', 42, {}, []]) {
      assert.throws(
        () => validateMemoryVersionManifest(manifiesto({ selectedScopes: malo })),
        /selectedScopes must be a non-empty array/,
        `aceptó ${JSON.stringify(malo)}`,
      )
    }
  })

  it('rechaza un scope no soportado y acepta los soportados', () => {
    assert.throws(
      () => validateMemoryVersionManifest(manifiesto({ selectedScopes: ['inventado'] })),
      /unsupported scope/,
    )
  })

  it('bundleMetadata null es requerido cuando sourceTransport es bundle', () => {
    // La guardia es `!== undefined && !== null`; con `and→or` un `null` pasa,
    // porque `null !== undefined` alcanza. Es el caso que mata ese mutante.
    assert.throws(
      () => validateMemoryVersionManifest(manifiesto({ sourceTransport: 'bundle', bundleMetadata: null })),
      /bundleMetadata is required when sourceTransport is "bundle"/,
    )
  })
})

describe('los elementos de una lista de decisiones, y el path del artefacto', () => {
  it('las tres listas de decisions rechazan un elemento no-string o vacío', async () => {
    // Alcanzable: `normalizeDecisionList` corre ANTES de leer el bundle. Se
    // ejercita cada lista por separado porque son tres llamadas y una sola
    // bastaría para que las otras dos nunca corran con entrada mala.
    for (const campo of ['retain', 'complement', 'discard']) {
      for (const malo of [42, '', '   ']) {
        await assert.rejects(
          () => importMemoryBundle({ ...BASES.importMemoryBundle(), decisions: { [campo]: [malo] } }),
          /must only contain non-empty strings/,
          `${campo} aceptó ${JSON.stringify(malo)}`,
        )
      }
    }
  })

  it('una lista de decisions que no es array se rechaza', async () => {
    await assert.rejects(
      () => importMemoryBundle({ ...BASES.importMemoryBundle(), decisions: { retain: 'memories' } }),
      /must be an array/,
    )
  })

  it('el path del artefacto no puede resolver a la raíz de exports', () => {
    // `resolve(root, '.')` es la raíz, y `relative(root, root)` es la cadena
    // vacía: largo 0, así que la guardia `length > 0` dispara. Con `gt→gte`
    // —`>= 0`, siempre verdadero— pasaría y `resolveExportArtifactPath`
    // devolvería el directorio entero como si fuera un archivo.
    //
    // Se usa `'.'` y no `''` porque la cadena vacía la atrapa la guardia
    // anterior (`relativeArtifactPath is required`), y un caso que muere en la
    // guardia de al lado no prueba la que dice probar.
    assert.throws(
      () => resolveExportArtifactPath('/tmp/exports-aoi', '.'),
      /must point to a file inside the exports root/,
    )
  })
})

describe('las últimas guardias alcanzables sin fixture', () => {
  it('rechaza exportedAt que no es string, aunque sea parseable', async () => {
    // La guardia es `typeof x === 'string' && !Number.isNaN(Date.parse(x))`. Con
    // `and→or`, un NÚMERO entra: `typeof 42 === 'string'` es falso pero
    // `Date.parse(42)` no es NaN, así que la segunda mitad alcanza.
    for (const malo of [42, null, {}]) {
      await assert.rejects(
        () => exportMemoryBundle({ ...BASES.exportMemoryBundle(), exportedAt: malo }),
        /exportedAt must be a valid ISO date string/,
      )
    }
  })

  it('rechaza exportedAt que es string pero no es fecha', async () => {
    for (const malo of ['', 'ayer', '2026-99-99']) {
      await assert.rejects(
        () => exportMemoryBundle({ ...BASES.exportMemoryBundle(), exportedAt: malo }),
        /exportedAt must be a valid ISO date string/,
      )
    }
  })

  it('rechaza "all" combinado con otros scopes', async () => {
    // `scopes.length === 1`: la combinación sólo es válida sola.
    for (const malo of [['all', 'memories'], ['memories', 'all'], ['all', 'all']]) {
      await assert.rejects(
        () => exportMemoryBundle({ ...BASES.exportMemoryBundle(), selectedScopes: malo }),
        /cannot combine "all" with other scopes/,
      )
    }
  })

  it('CONTROL: "all" solo sí se acepta', async () => {
    // La otra dirección: sin este caso, la guardia podría rechazar todo.
    await assert.rejects(
      () => exportMemoryBundle({ ...BASES.exportMemoryBundle(), selectedScopes: ['all'] }),
      (err) => !/cannot combine/.test(err.message),
      '"all" solo no debería disparar la guardia de combinación',
    )
  })

  it('las tres listas de decisions de prepareVersionManifest', async () => {
    for (const campo of ['retain', 'complement', 'discard']) {
      for (const malo of [42, '', '   ']) {
        await assert.rejects(
          () => prepareVersionManifest({ ...BASES.prepareVersionManifest(), decisions: { [campo]: [malo] } }),
          // `must contain` y no `must only contain`: este módulo y
          // `import-memory-bundle` tienen el MISMO guard con mensajes distintos.
          // El texto importa para el que lo lee, así que se fija el de cada uno.
          /must contain non-empty strings/,
          `${campo} aceptó ${JSON.stringify(malo)}`,
        )
      }
    }
  })

  it('resolveActiveVersion rechaza un workspace vacío y uno que no es string', async () => {
    // `!workspace || typeof workspace !== 'string'`. Con `or→and` la cadena vacía
    // pasa: `!""` es verdadero pero `typeof "" !== 'string'` es falso.
    for (const malo of ['', 42, null]) {
      await assert.rejects(() => resolveActiveVersion({ workspace: malo }), /workspace is required/)
    }
  })

  it('parseBundleArgs ignora los tokens que no son flags', () => {
    // `typeof token !== 'string' || !token.startsWith('--')`. Con `or→and`, un
    // token no-string que además no empiece con `--` dejaría de saltarse.
    const salida = parseBundleArgs(
      ['ws', 'v1', 'a.memory-bundle.json.gz', 'suelto', 42, null, '--owner-context', 'ctx'],
      { lists: [] },
    )
    assert.equal(salida.flags?.['owner-context'] ?? salida['owner-context'], 'ctx')
    for (const suelto of ['suelto', '42', 'null']) {
      assert.equal(Object.hasOwn(salida, suelto), false, `"${suelto}" no puede volverse una clave`)
    }
  })
})
