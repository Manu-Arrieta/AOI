/**
 * scripts/multi-harness/provider-config.test.mjs
 *
 * Fixtures sintéticas en un `home` inyectado, nunca el de la máquina: una aserción
 * sobre "el HOME donde estoy corriendo" es un fixture escondido que pasa acá y
 * falla en los otros árboles que corren esta cadena.
 *
 * El caso que más importa es el de la fuga: el archivo de entrada tiene una `apiKey`
 * y el resultado no puede contenerla. Es una invariante de seguridad, no de forma.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  configCandidates,
  discoverProviders,
  flatten,
  formatReport,
  groupByProvider,
  readProviders,
  vsCodeUserDir,
} from './provider-config.mjs'

const SECRET = 'sk-DEADBEEF-no-debe-salir-nunca'

const provider = (name, models, vendor = 'customendpoint') => ({
  name,
  vendor,
  apiKey: `\${input:chat.lm.secret.${name}}`,
  models: models.map(([id, n]) => ({ id, name: n, url: 'https://x' })),
})

/** Escribe una config en la ruta relativa al `home` dado. */
function withConfig(home, rel, content) {
  const file = path.join(home, ...rel.split('/'))
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
  return file
}

/** Un `home` de macOS con la estructura de VS Code. */
function fakeHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-vscode-'))
  fs.mkdirSync(path.join(home, 'Library/Application Support/Code/User'), { recursive: true })
  return home
}

const clean = (home) => fs.rmSync(home, { recursive: true, force: true })
const USER = 'Library/Application Support/Code/User'

describe('vsCodeUserDir', () => {
  it('resuelve la ruta de macOS, Linux y Windows', () => {
    // Windows NO usa homedir(): apunta a C:\Users\<u>, no a AppData/Roaming.
    assert.match(vsCodeUserDir('/Users/x', 'darwin'), /Library\/Application Support\/Code\/User$/)
    assert.match(vsCodeUserDir('/home/x', 'linux'), /\.config\/Code\/User$/)
    assert.equal(
      vsCodeUserDir('C:\\Users\\x', 'win32', { APPDATA: 'C:\\Users\\x\\AppData\\Roaming' }),
      path.join('C:\\Users\\x\\AppData\\Roaming', 'Code', 'User'),
    )
  })

  it('sin APPDATA en Windows cae a un default en vez de explotar', () => {
    assert.match(vsCodeUserDir('C:\\Users\\x', 'win32', {}), /AppData.Roaming.Code.User$/)
  })
})

describe('configCandidates', () => {
  it('pone los perfiles ANTES que las rutas sueltas', () => {
    // El perfil es el autoritativo: los sueltos son stubs vacíos o copias parciales.
    const home = fakeHome()
    fs.mkdirSync(path.join(home, USER, 'profiles/-abc'), { recursive: true })
    const c = configCandidates(home, 'darwin')

    assert.match(c[0], /profiles[/\\]-abc[/\\]chatLanguageModels\.json$/)
    assert.ok(
      c.indexOf(path.join(home, USER, 'ChatLanguageModel.json')) > 0,
      'la ruta del singular tiene que ir después de los perfiles',
    )
    clean(home)
  })

  it('sin perfiles igual devuelve las dos rutas sueltas', () => {
    const home = fakeHome()
    assert.equal(configCandidates(home, 'darwin').length, 2)
    clean(home)
  })
})

describe('readProviders', () => {
  it('nunca deja pasar la apiKey', () => {
    // Invariante de seguridad. El archivo la tiene; el resultado no puede.
    const home = fakeHome()
    const file = withConfig(home, `${USER}/ChatLanguageModel.json`, JSON.stringify([provider('Alfa', [['g', 'G']])]))

    const out = readProviders(file)

    assert.equal(out.length, 1)
    assert.equal(out[0].apiKey, undefined, 'apiKey se filtró')
    assert.ok(!JSON.stringify(out).includes(SECRET.slice(0, 10)), 'un valor de clave apareció en la salida')
    clean(home)
  })

  it('conserva name y vendor del proveedor, e id y name del modelo', () => {
    const home = fakeHome()
    const file = withConfig(
      home,
      `${USER}/ChatLanguageModel.json`,
      JSON.stringify([provider('Alfa', [['modelo-a5.2', 'ModeloA - Provider - Alfa']])]),
    )

    assert.deepEqual(readProviders(file), [
      { name: 'Alfa', vendor: 'customendpoint', models: [{ id: 'modelo-a5.2', name: 'ModeloA - Provider - Alfa' }] },
    ])
    clean(home)
  })

  it('un archivo ausente da null, no una lista vacía', () => {
    // `null` y `[]` son distintos: ausente es "no hay archivo", vacío es "hay archivo
    // sin providers". Colapsarlos es lo que hace parecer igual un stub de 2 bytes.
    assert.equal(readProviders('/no/existe/chatLanguageModels.json'), null)
  })

  it('un JSON inválido da null en vez de lanzar', () => {
    const home = fakeHome()
    const file = withConfig(home, `${USER}/ChatLanguageModel.json`, '{ no es json')
    assert.equal(readProviders(file), null)
    clean(home)
  })

  it('un objeto en vez de array da null: la forma se valida', () => {
    const home = fakeHome()
    const file = withConfig(home, `${USER}/ChatLanguageModel.json`, JSON.stringify({ providers: [] }))
    assert.equal(readProviders(file), null)
    clean(home)
  })

  it('un provider sin models no explota', () => {
    const home = fakeHome()
    const file = withConfig(home, `${USER}/ChatLanguageModel.json`, JSON.stringify([{ name: 'X', vendor: 'v' }]))
    assert.deepEqual(readProviders(file), [{ name: 'X', vendor: 'v', models: [] }])
    clean(home)
  })
})

describe('flatten', () => {
  it('aplana conservando el nombre del proveedor', () => {
    const e = flatten([provider('Gama', [['a', 'A'], ['b', 'B']])])
    assert.equal(e.length, 2)
    assert.equal(e[1].provider, 'Gama')
    assert.equal(e[1].id, 'b')
  })

  it('sin entrada no explota', () => {
    assert.deepEqual(flatten(undefined), [])
  })
})

describe('discoverProviders', () => {
  it('elige el perfil con proveedores sobre los stubs vacíos', () => {
    // El escenario exacto de la máquina auditada: el plural es `[]`, el singular
    // tiene una copia parcial, el perfil tiene la buena.
    const home = fakeHome()
    withConfig(home, `${USER}/chatLanguageModels.json`, '[]')
    withConfig(home, `${USER}/ChatLanguageModel.json`, JSON.stringify([provider('Gama', [['n', 'N - Provider - Gama']])]))
    withConfig(
      home,
      `${USER}/profiles/-5f85a270/chatLanguageModels.json`,
      JSON.stringify([
        provider('Gama', [['n', 'N - Provider - Gama']]),
        provider('Alfa', [['modelo-a5.2', 'ModeloA - Provider - Alfa']]),
      ]),
    )

    const r = discoverProviders(home, 'darwin')

    assert.match(r.path, /profiles[/\\]-5f85a270/)
    assert.equal(r.entries.length, 2)
    clean(home)
  })

  it('reporta los descartados con su conteo, para que un vacío no se lea como ausente', () => {
    // Sin esto, un stub de 2 bytes y un archivo inexistente se leen igual.
    const home = fakeHome()
    withConfig(home, `${USER}/chatLanguageModels.json`, '[]')

    const r = discoverProviders(home, 'darwin')

    assert.equal(r.path, null)
    const plural = r.considered.find((c) => c.path.endsWith('chatLanguageModels.json') && !c.path.includes('profiles'))
    assert.equal(plural.present, true, 'el stub existe')
    assert.equal(plural.models, 0, 'y declara cero modelos')
    const absent = r.considered.find((c) => c.path.endsWith('ChatLanguageModel.json'))
    assert.equal(absent.present, false)
    clean(home)
  })

  it('sin ninguna config devuelve entries vacío y contadores en cero', () => {
    const home = fakeHome()
    const r = discoverProviders(home, 'darwin')

    assert.equal(r.path, null)
    assert.deepEqual(r.entries, [])
    assert.equal(r.sources, 0)
    clean(home)
  })

  it('un home sin VS Code no explota', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-vscode-vacio-'))
    assert.deepEqual(discoverProviders(home, 'linux').entries, [])
    clean(home)
  })
})

describe('groupByProvider', () => {
  it('agrupa por proveedor conservando el orden de aparición', () => {
    const g = groupByProvider([{ provider: 'A' }, { provider: 'B' }, { provider: 'A' }])

    assert.deepEqual([...g.keys()], ['A', 'B'])
    assert.equal(g.get('A').length, 2)
  })

  it('sin entradas da un mapa vacío, no una entrada inventada', () => {
    assert.equal(groupByProvider([]).size, 0)
  })
})

describe('formatReport', () => {
  it('nombra los proveedores y sus modelos cuando los hay', () => {
    const text = formatReport({
      path: '/x/chatLanguageModels.json',
      entries: [
        { provider: 'Alfa', id: 'modelo-a5.2', name: 'ModeloA - Provider - Alfa' },
        { provider: 'Alfa', id: 'g2', name: 'ModeloB - Provider - Alfa' },
      ],
      sources: 1,
      considered: [],
    })

    assert.match(text, /2 modelos en 1 ubicación/)
    assert.match(text, /Alfa — 2 modelo\(s\)/)
    assert.doesNotMatch(text, /Agregá los proveedores/, 'no debe dar instrucciones cuando ya hay')
  })

  it('cuando no hay configuración nombra las ubicaciones y cómo agregar', () => {
    // Es la salida ACCIONABLE: el operador la lee justo cuando no tiene nada. Un
    // "no hay proveedores" sin la lista de rutas se lee igual que un bug de detección.
    const text = formatReport({
      path: null,
      entries: [],
      sources: 0,
      considered: [
        { path: '/a/chatLanguageModels.json', models: 0, present: true },
        { path: '/b/ChatLanguageModel.json', models: 0, present: false },
      ],
    })

    assert.match(text, /Se revisaron 2 ubicaciones/)
    assert.match(text, /existe, 0 modelos/)
    assert.match(text, /ausente/)
    assert.match(text, /Manage Models/)
    assert.match(text, /no es reproducible/, 'tiene que explicar por qué un script no puede')
  })

  it('avisa sólo cuando más de una ubicación declara proveedores', () => {
    // El número cuenta UBICACIONES, no perfiles: en la máquina auditada daba 2 y el
    // segundo era `ChatLanguageModel.json` de la raíz, que no es un perfil.
    const at = (sources) =>
      formatReport({
        path: '/x',
        entries: [{ provider: 'Alfa', id: 'g', name: 'G - Provider - Alfa' }],
        sources,
        considered: [],
      })

    assert.match(at(2), /2 ubicaciones declaran proveedores/)
    assert.doesNotMatch(at(1), /ubicaciones declaran/)
  })
})

describe('el detector no escribe', () => {
  it('leer la configuración no la modifica ni crea archivos', () => {
    // Invariante del arreglo de C7: el flujo copiaba el template SOBRE la config real.
    // Es conductual, no una aserción de texto: correr la detección de verdad y
    // comparar bytes y entradas de directorio antes y después.
    const home = fakeHome()
    const file = withConfig(home, `${USER}/ChatLanguageModel.json`, JSON.stringify([provider('Alfa', [['g', 'G']])]))
    const before = fs.readFileSync(file, 'utf8')
    const entriesBefore = fs.readdirSync(path.join(home, USER)).sort()

    discoverProviders(home, 'darwin')

    assert.equal(fs.readFileSync(file, 'utf8'), before, 'la configuración cambió')
    assert.deepEqual(fs.readdirSync(path.join(home, USER)).sort(), entriesBefore, 'apareció o desapareció un archivo')
    clean(home)
  })
})
