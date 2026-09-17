/**
 * scripts/code-lens/interaction-graph.test.mjs
 *
 * El contrato del extractor de aristas.
 *
 * Lo que este archivo vigila no es "el grafo se arma": es que el grafo no
 * MIENTA en las dos direcciones posibles. Un extractor léxico puede inventar
 * una arista —una ruta citada dentro de un mensaje de error parece un import— o
 * puede perderla. Las dos fallas degradan el documento que lo consume, y las
 * dos son silenciosas, así que cada propiedad viene con su control negativo:
 * una entrada construida para que el extractor DEBA rechazarla.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  buildInteractionGraph,
  commandMap,
  hookChain,
  hookDeclarations,
  importCycles,
  importDependents,
  installerPhases,
  moduleImports,
  promptInvocations,
  hubs,
} from './interaction-graph.mjs'

const REPO = path.resolve(import.meta.dirname, '../..')

/** Crea un árbol de prueba aislado y lo destruye al terminar. */
function withFixture(files, run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-graph-'))
  try {
    for (const [rel, body] of Object.entries(files)) {
      const full = path.join(dir, rel)
      fs.mkdirSync(path.dirname(full), { recursive: true })
      fs.writeFileSync(full, body)
    }
    return run(dir)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

describe('moduleImports', () => {
  it('registra un import relativo que resuelve a un archivo real', () => {
    const edges = withFixture(
      {
        'scripts/a.mjs': "import { x } from './b.mjs'\n",
        'scripts/b.mjs': 'export const x = 1\n',
      },
      (dir) => moduleImports(dir),
    )
    assert.deepEqual(edges['scripts/a.mjs'], ['scripts/b.mjs'])
  })

  it('CONTROL NEGATIVO: una ruta citada que NO resuelve no genera arista', () => {
    // Es el caso real que motivó `resolveImport`: varios módulos de memory-sync
    // imprimen su propia ruta en el texto de ayuda, y un extractor ingenuo la
    // leía como una dependencia de sí mismos.
    const edges = withFixture(
      {
        'scripts/a.mjs': "throw new Error(\"usage: node from './no-existe.mjs'\")\n",
      },
      (dir) => moduleImports(dir),
    )
    assert.equal(edges['scripts/a.mjs'], undefined)
  })

  it('CONTROL NEGATIVO: no recorre el espejo scaffold/ de la raíz', () => {
    const edges = withFixture(
      {
        'scripts/a.mjs': "import './b.mjs'\n",
        'scripts/b.mjs': 'export default 1\n',
        'scaffold/scripts/a.mjs': "import './b.mjs'\n",
        'scaffold/scripts/b.mjs': 'export default 1\n',
      },
      (dir) => moduleImports(dir),
    )
    assert.ok(edges['scripts/a.mjs'], 'la fuente real debe estar')
    assert.ok(
      !Object.keys(edges).some((k) => k.startsWith('scaffold/')),
      'el espejo no puede aparecer en el grafo',
    )
  })

  it('sí recorre scripts/scaffold/, que son fuentes de las compuertas', () => {
    // Regresión medida: filtrar por el nombre 'scaffold' dejaba ocho módulos de
    // calidad —validate-srp, mutation-ratchet, parity— fuera del grafo entero.
    const edges = moduleImports(REPO)
    const reales = Object.keys(edges).filter((k) => k.startsWith('scripts/scaffold/'))
    assert.ok(reales.length > 0, 'scripts/scaffold/ debe estar representado')
  })
})

describe('importDependents', () => {
  it('invierte las aristas y ordena de forma estable', () => {
    const inverted = importDependents({ 'a.mjs': ['c.mjs'], 'b.mjs': ['c.mjs'] })
    assert.deepEqual(inverted, { 'c.mjs': ['a.mjs', 'b.mjs'] })
  })
})

describe('importCycles', () => {
  it('detecta un ciclo mutuo una sola vez', () => {
    const cycles = importCycles({ imports: { 'a.mjs': ['b.mjs'], 'b.mjs': ['a.mjs'] } })
    assert.deepEqual(cycles, [['a.mjs', 'b.mjs']])
  })

  it('CONTROL NEGATIVO: una dependencia unidireccional no es un ciclo', () => {
    const cycles = importCycles({ imports: { 'a.mjs': ['b.mjs'], 'b.mjs': [] } })
    assert.deepEqual(cycles, [])
  })
})

describe('hookChain', () => {
  it('conserva el ORDEN de ejecución dentro de cada evento', () => {
    // El orden no es decorativo: en PreToolUse la memoria se consulta antes de
    // que RTK reescriba el comando. Invertirlo cambia lo que se persiste.
    const chain = withFixture(
      {
        '.claude/settings.json': JSON.stringify({
          hooks: {
            PreToolUse: [
              { matcher: 'Bash', hooks: [{ command: 'primero', timeout: 5 }, { command: 'segundo' }] },
            ],
          },
        }),
      },
      (dir) => hookChain(dir),
    )
    assert.deepEqual(chain.PreToolUse.map((h) => h.command), ['primero', 'segundo'])
    assert.equal(chain.PreToolUse[0].matcher, 'Bash')
    assert.equal(chain.PreToolUse[1].timeout, null)
  })

  it('devuelve {} si el harness no está configurado, sin romper', () => {
    assert.deepEqual(withFixture({}, (dir) => hookChain(dir)), {})
  })
})

describe('hookDeclarations', () => {
  it('lee la fuente única y atribuye cada hook a su archivo declarante', () => {
    // El compilado (.claude/settings.json) dice QUÉ corre; la declaración dice
    // QUIÉN lo pidió. Sin la segunda, una divergencia entre ambos es invisible.
    const declared = withFixture(
      {
        '.github/hooks/rtk.json': JSON.stringify({
          hooks: { PreToolUse: [{ command: 'bash .github/scripts/rtk-hook.sh', timeout: 5 }] },
        }),
      },
      (dir) => hookDeclarations(dir),
    )
    assert.equal(declared.PreToolUse.length, 1)
    assert.equal(declared.PreToolUse[0].source, '.github/hooks/rtk.json')
  })

  it('sobre el repositorio real, toda declaración llega al compilado', () => {
    // La costura que importa: un hook declarado que install-hooks no tradujo
    // queda muerto, y nada en el árbol lo delata salvo esta comparación.
    const declaradas = Object.values(hookDeclarations(REPO)).flat().map((h) => h.command)
    const compiladas = new Set(Object.values(hookChain(REPO)).flat().map((h) => h.command))
    for (const cmd of declaradas) {
      assert.ok(compiladas.has(cmd), `declarado pero ausente del compilado: ${cmd}`)
    }
  })
})

describe('commandMap', () => {
  it('parte la cadena secuencial de pnpm test en sus pasos', () => {
    const { commands, testChain } = withFixture(
      {
        'package.json': JSON.stringify({
          scripts: { test: 'pnpm a && pnpm b', a: 'node scripts/x.mjs' },
        }),
      },
      (dir) => commandMap(dir),
    )
    assert.deepEqual(testChain, ['pnpm a', 'pnpm b'])
    assert.deepEqual(commands.a.targets, ['scripts/x.mjs'])
  })
})

describe('installerPhases', () => {
  it('extrae las fases en orden de ejecución desde header "..."', () => {
    const phases = withFixture(
      { 'setup.sh': 'header "Phase 1: Tools"\ncode\nheader "Phase 2: Spec-Kit"\n' },
      (dir) => installerPhases(dir),
    )
    assert.deepEqual(phases, ['Phase 1: Tools', 'Phase 2: Spec-Kit'])
  })

  it('CONTROL NEGATIVO: un banner en comentario no cuenta como fase', () => {
    // setup.sh tiene banners `# ── Phase N ──` que NO imprimen nada. Sólo
    // `header` marca una fase que el Owner ve en pantalla.
    const phases = withFixture(
      { 'setup.sh': '# ── Phase 9: Fantasma ──────\necho hola\n' },
      (dir) => installerPhases(dir),
    )
    assert.deepEqual(phases, [])
  })
})

describe('promptInvocations sobre el repositorio real', () => {
  it('captura las aristas declaradas del ciclo SDD', () => {
    const edges = promptInvocations(REPO)
    assert.ok(edges['sdd-verify'], 'sdd-verify debe declarar invocaciones')
    assert.ok(
      edges['sdd-verify'].scripts.includes('scripts/sdd-lifecycle/invariant-gate.mjs'),
      'sdd-verify invoca el invariant gate',
    )
    assert.ok(edges['sdd-verify'].agents.length > 0, 'sdd-verify delega en agentes')
  })
})

describe('buildInteractionGraph', () => {
  it('es determinista: dos corridas sobre el mismo árbol dan bytes idénticos', () => {
    // La propiedad que justifica versionar la salida: un diff sólo aparece si
    // cambió la arquitectura, nunca por el orden en que el FS listó un dir.
    const a = JSON.stringify(buildInteractionGraph(REPO))
    const b = JSON.stringify(buildInteractionGraph(REPO))
    assert.equal(a, b)
  })

  it('expone los hubs ordenados por fan-out descendente', () => {
    const ranked = hubs(buildInteractionGraph(REPO), 5)
    assert.ok(ranked.length > 0)
    for (let i = 1; i < ranked.length; i += 1) {
      assert.ok(ranked[i - 1].fanOut >= ranked[i].fanOut, 'debe ir de mayor a menor')
    }
  })
})
