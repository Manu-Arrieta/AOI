/**
 * scripts/memory-sync/argument-guards.test.mjs
 *
 * Las guardias de argumentos, ejercitadas con la entrada que las hace falta.
 *
 * Nació de leer los 78 mutantes supervivientes del área. **Sesenta eran de
 * operador booleano**, y al mirar las líneas el patrón era uno solo: casi todas
 * las guardias se escriben así
 *
 *     assert(typeof x === 'string' && x.trim().length > 0, 'x is required.')
 *
 * y cada una deja sobrevivir DOS mutantes, por la misma razón:
 *
 *   `gt→gte`  `length >= 0` es SIEMPRE verdadero, así que la guardia no dispara
 *             nunca más. Se mata pasando `''` o `'   '` — y ningún test lo hacía:
 *             todos pasaban un nombre válido.
 *
 *   `and→or`  `typeof x === 'string' || x.trim()…` deja de mirar el tipo, así que
 *             con un NÚMERO el `.trim()` tira `TypeError` y el mensaje de la
 *             guardia no aparece nunca. Se mata pasando un no-string y exigiendo
 *             el mensaje de la guardia, no un error cualquiera.
 *
 * O sea: **una guardia ejercitada sólo con entrada válida no está ejercitada.** Es
 * exactamente lo que el test del sandbox ya dice de su propio validador —*"A
 * validator exercised only with valid input is not a validator: it is a
 * pass-through with a comment"*— y acá vale palabra por palabra.
 *
 * Por qué una tabla y no cuarenta tests: los casos no tienen lógica propia, son
 * la misma aserción sobre cuarenta pares (campo, mensaje). Una tabla dice de un
 * vistazo qué está cubierto y qué no, y agrega un caso en una línea. Cuarenta
 * funciones casi idénticas esconderían el hecho de que son el mismo caso.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { activateVersion } from './activate-version.mjs'
import { exportMemoryBundle } from './export-memory-bundle.mjs'
import { importMemoryBundle } from './import-memory-bundle.mjs'
import { prepareVersionManifest } from './prepare-version-manifest.mjs'
import { rollbackVersion } from './rollback-version.mjs'
import { validateMemoryVersionManifest } from './schema.mjs'
import { resolveExportArtifactPath } from './store-utils.mjs'
import { parseBundleArgs } from './cli-args.mjs'
import { resolveActiveVersion } from './resolve-active-version.mjs'

/** Las dos entradas que matan a los dos mutantes de cada guardia de string. */
const REJECTED = { vacio: '', enBlanco: '   ', noString: 42 }

const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-guards-'))

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
  rollbackVersion: () => ({ workspace: 'ws', targetVersionId: 'v1', reason: 'motivo', versionsRoot: raiz }),
  activateVersion: () => ({ workspace: 'ws', versionId: 'v1', versionsRoot: raiz }),
}

/**
 * `[nombre, funcion, campo, patron del mensaje]`, y de cada fila se generan los
 * tres casos de `REJECTED`. Es la lista COMPLETA de guardias de string de las
 * cinco funciones: si aparece una nueva, tiene que entrar acá.
 */
const GUARDIAS = [
  ['exportMemoryBundle', exportMemoryBundle, 'workspace', /workspace is required/],
  ['exportMemoryBundle', exportMemoryBundle, 'versionId', /versionId is required/],
  ['exportMemoryBundle', exportMemoryBundle, 'relativeArtifactPath', /relativeArtifactPath is required/],
  ['exportMemoryBundle', exportMemoryBundle, 'formatVersion', /formatVersion must be a non-empty string/],
  ['importMemoryBundle', importMemoryBundle, 'workspace', /workspace is required/],
  ['importMemoryBundle', importMemoryBundle, 'versionId', /versionId is required/],
  ['importMemoryBundle', importMemoryBundle, 'relativeArtifactPath', /relativeArtifactPath is required/],
  ['importMemoryBundle', importMemoryBundle, 'ownerContext', /ownerContext is required/],
  ['prepareVersionManifest', prepareVersionManifest, 'workspace', /workspace is required/],
  ['prepareVersionManifest', prepareVersionManifest, 'versionId', /versionId is required/],
  ['prepareVersionManifest', prepareVersionManifest, 'sourceWorkspace', /sourceWorkspace is required/],
  ['prepareVersionManifest', prepareVersionManifest, 'sourceVersionId', /sourceVersionId is required/],
  ['prepareVersionManifest', prepareVersionManifest, 'ownerContext', /ownerContext is required/],
  ['rollbackVersion', rollbackVersion, 'workspace', /workspace is required/],
  ['rollbackVersion', rollbackVersion, 'targetVersionId', /targetVersionId is required/],
  ['rollbackVersion', rollbackVersion, 'reason', /reason is required/],
  ['activateVersion', activateVersion, 'workspace', /workspace is required/],
  ['activateVersion', activateVersion, 'versionId', /versionId is required/],
]

describe('toda guardia de string rechaza las tres entradas que la hacen falta', () => {
  for (const [nombre, fn, campo, patron] of GUARDIAS) {
    for (const [etiqueta, valor] of Object.entries(REJECTED)) {
      it(`${nombre}: ${campo} = ${etiqueta}`, async () => {
        const args = { ...BASES[nombre](), [campo]: valor }
        // El mensaje de la guardia y no un error cualquiera: con `and→or` el
        // no-string explota en un `TypeError` antes de llegar al assert, y eso
        // tiene que contar como fallo.
        await assert.rejects(() => fn(args), patron)
      })
    }
  }
})

describe('las guardias de forma rechazan lo que no es de su tipo', () => {
  // Dos de estas guardias eran INALCANZABLES y se arreglaron haciéndolas vivas
  // en vez de agregándoles un test: código muerto no se cubre, se hace vivo o se
  // borra. Las otras dos ya eran alcanzables, y lo que faltaba era la entrada.
  const noEsLista = 'selectedScopes must be an array.'

  it('exportMemoryBundle: selectedScopes rechaza un string, que se desparramaba', async () => {
    // `'memories'.length` es verdadero, así que el ternario hacía
    // `[...'memories']` -> `['m','e','m',…]` y el error que salía era
    // `unexpected scope "m"`: sobre un carácter, no sobre el tipo.
    await assert.rejects(
      () => exportMemoryBundle({ ...BASES.exportMemoryBundle(), selectedScopes: 'memories' }),
      new RegExp(noEsLista),
    )
  })

  it('exportMemoryBundle: selectedScopes rechaza un no-array', async () => {
    for (const malo of [42, {}, true]) {
      await assert.rejects(
        () => exportMemoryBundle({ ...BASES.exportMemoryBundle(), selectedScopes: malo }),
        new RegExp(noEsLista),
      )
    }
  })

  it('prepareVersionManifest: selectedScopes rechaza un string y un no-array', async () => {
    for (const malo of ['memories', 42, {}]) {
      await assert.rejects(
        () => prepareVersionManifest({ ...BASES.prepareVersionManifest(), selectedScopes: malo }),
        new RegExp(noEsLista),
      )
    }
  })

  it('CONTROL: las dos siguen aceptando una lista de verdad', async () => {
    // Sin este control, la guardia podría rechazar TODO y los casos de arriba
    // seguirían pasando. Es la dirección que más se olvida.
    for (const bueno of [['memories'], ['memories', 'feedback'], undefined]) {
      await assert.rejects(
        () => prepareVersionManifest({ ...BASES.prepareVersionManifest(), selectedScopes: bueno, versionsRoot: raiz }),
        (err) => !new RegExp(noEsLista).test(err.message),
        `rechazó ${JSON.stringify(bueno)} por la guardia de tipo, que debería aceptarlo`,
      )
    }
  })

  it('selectedScopes rechaza un elemento vacío, en blanco o no-string', async () => {
    // Alcanzable desde que la normalización corre ANTES de la lectura del
    // manifiesto. Antes vivía después, así que este caso se reportaba como un
    // ENOENT del manifiesto en vez de como el argumento que estaba mal.
    for (const malo of ['', '   ', 42]) {
      await assert.rejects(
        () => exportMemoryBundle({ ...BASES.exportMemoryBundle(), selectedScopes: [malo] }),
        /selectedScopes must only contain non-empty strings/,
      )
    }
  })

  it('bundleMetadata no acepta un array, que sí es un object', async () => {
    // `isPlainObject` es `typeof v === 'object' && v !== null && !Array.isArray(v)`.
    // Con el primer `and→or` un array entra: `typeof [] === 'object'` alcanza.
    await assert.rejects(
      () => prepareVersionManifest({ ...BASES.prepareVersionManifest(), bundleMetadata: [] }),
      /bundleMetadata must be an object or null/,
    )
  })

  it('sourceTransport no acepta un valor fuera del conjunto', async () => {
    // La guardia es un `has(...)` sobre un Set, así que el mutante que la rompe
    // es un valor fuera del conjunto y no un tipo raro.
    await assert.rejects(
      () => prepareVersionManifest({ ...BASES.prepareVersionManifest(), sourceTransport: 'inventado' }),
      /sourceTransport must be one of/,
    )
  })
})

