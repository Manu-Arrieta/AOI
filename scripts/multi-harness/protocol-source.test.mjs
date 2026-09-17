import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { ICM_PROTOCOL, fallbackStoreTriggers, prunePathIfPristine, readMcpActivation, readStoreTriggers, renderMcpActivation, renderStoreTriggers } from './protocol-source.mjs'
import { generateClaudeMd, generateCopilotInstructions } from './compile-rules.mjs'
import { isWorkspaceScopedTopic } from '../memory-sync/icm-scope-loaders.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('the harness surfaces are derived from the protocol, not copied', () => {
  it('reads every importance level the protocol declares', () => {
    const levels = readStoreTriggers(REPO)
    for (const l of ['critical', 'high', 'medium', 'low']) {
      assert.ok(levels[l], `el protocolo declara ${l} y el lector no lo ve`)
    }
  })

  it('CLAUDE.md and copilot-instructions agree with the protocol on every level', () => {
    // The contradiction this ends: the generated CLAUDE.md said `-i high` for
    // an architecture decision while the protocol said `critical`. Both
    // surfaces are always in context, so an agent read both on every task.
    const levels = readStoreTriggers(REPO)
    const claude = generateClaudeMd({ workspace: 'AOI', repoRoot: REPO })
    const copilot = generateCopilotInstructions({ workspace: 'AOI', repoRoot: REPO })

    for (const [level, cases] of Object.entries(levels)) {
      for (const [name, text] of [['CLAUDE.md', claude], ['copilot-instructions', copilot]]) {
        // El protocolo escribe los topics con `{WORKSPACE}` porque su regla es
        // que todo topic lleve prefijo; la superficie compilada lo sustituye.
        // La expectativa sustituye igual, o el caso exigiría que el placeholder
        // llegara crudo al archivo — que es justo el defecto que se arregló.
        const esperado = cases.replaceAll('{WORKSPACE}', 'AOI')
        assert.ok(text.includes(`\`-i ${level}\` → ${esperado}`), `${name} no refleja el nivel ${level}`)
      }
    }
  })

  it('no generated surface contradicts the protocol on architecture decisions', () => {
    // The specific drift that occurred, asserted by name so a future rewrite
    // that reintroduces it fails here rather than in someone's context window.
    const claude = generateClaudeMd({ workspace: 'AOI', repoRoot: REPO })
    const copilot = generateCopilotInstructions({ workspace: 'AOI', repoRoot: REPO })
    for (const text of [claude, copilot]) {
      assert.doesNotMatch(text, /decisi[oó]n de arquitectura[^\n]*-i high/i)
      assert.doesNotMatch(text, /Architecture[^\n]*-i high/i)
    }
  })

  it('names the store topics the way the scoping rule reads them', () => {
    // `{ws}-X`, never `X-{ws}`. The generator emitted the reversed form for both
    // `context` and `decisions`, so a memory stored by obeying the instruction
    // landed OUTSIDE its own workspace's scope. Measured in the shared DB:
    // `context-AOI` 256 against `AOI-context` 3, `decisions-AOI` 59 against
    // `AOI-decisions` 2 — the generator wrote the drift and every agent that
    // followed it deepened it.
    //
    // Asserted against `isWorkspaceScopedTopic` — the rule that CONSUMES these
    // names — rather than against a literal, so generator and rule cannot drift
    // apart in silence. A literal here would still pass if the rule changed.
    const WS = 'AOI'
    const fallback = fallbackStoreTriggers(WS)
    const surfaces = [
      ['CLAUDE.md', generateClaudeMd({ workspace: WS, repoRoot: REPO })],
      ['copilot-instructions.md', generateCopilotInstructions({ workspace: WS, repoRoot: REPO })],
      // El fallback también, porque es el camino de degradación: si nombra los
      // topics al revés, la degradación reintroduce el defecto que arregló el fix.
      ['fallback claude', fallback.claude],
      ['fallback copilot', fallback.copilot],
    ]

    // Los CUATRO, no dos. Este caso cubría sólo `context` y `decisions` —
    // los que tenían el prefijo INVERTIDO— y dejaba afuera `errors-resolved` y
    // `preferences`, que no tenían prefijo NINGUNO. El generador los emitía
    // pelados contra la regla en negrita de su propia fuente ("ALL topics MUST
    // be prefixed"), así que caían en cubos GLOBALES compartidos por todos los
    // proyectos de la máquina: medido en la DB, `errors-resolved` 114 y
    // `preferences` 15 contra `AOI-errors-resolved` 16 y `AOI-preferences` 2.
    // Un caso que cubre parte de una superficie reporta verde, y ese verde se
    // lee como cobertura entera.
    for (const [name, text] of surfaces) {
      for (const topic of [`${WS}-context`, `${WS}-decisions`, `${WS}-errors-resolved`, `${WS}-preferences`]) {
        assert.ok(text.includes(topic), `${name} no nombra ${topic}`)
        assert.equal(isWorkspaceScopedTopic(topic, WS), true, `${topic} tiene que contar como del workspace`)
      }

      // Sin prefijo el topic es global, no del workspace. La aserción no puede
      // ser `includes`, porque `AOI-errors-resolved` contiene `errors-resolved`:
      // el lookbehind es lo que distingue el topic pelado del prefijado.
      for (const bare of ['errors-resolved', 'preferences']) {
        assert.equal(isWorkspaceScopedTopic(bare, WS), false, `${bare} no debería ser scoped`)
        assert.doesNotMatch(text, new RegExp(`(?<!${WS}-)\\b${bare}\\b`), `${name} nombra el topic global ${bare}`)
      }

      // El placeholder llegaba sin sustituir a la superficie compilada, que le
      // ordenaba al agente un topic que literalmente no existe.
      assert.doesNotMatch(text, /\{WORKSPACE\}/, `${name} filtró el placeholder sin sustituir`)

      for (const reversed of [`context-${WS}`, `decisions-${WS}`]) {
        // El prefijo invertido no sólo "se ve raro": la regla lo rechaza, y eso
        // es lo que hace que el nombre sea un defecto y no una preferencia.
        assert.equal(isWorkspaceScopedTopic(reversed, WS), false, `${reversed} no debería ser scoped`)
        assert.equal(text.includes(reversed), false, `${name} volvió al prefijo invertido: ${reversed}`)
      }
    }
  })

  it('falls back instead of emitting rules with holes when the protocol is unreadable', () => {
    // A parse failure must degrade to the previous wording. Emitting a block
    // with levels missing would be worse than not deriving at all.
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-proto-'))
    assert.deepEqual(readStoreTriggers(empty), {})
    assert.equal(renderStoreTriggers({}, 'AOI'), '')

    const md = generateClaudeMd({ workspace: 'AOI', repoRoot: empty })
    assert.match(md, /Store Triggers \(MANDATORY\)/, 'la degradación dejó la sección vacía')
    assert.doesNotMatch(md, /decisions-AOI[^\n]*-i high/, 'el fallback reintrodujo la contradicción')
    fs.rmSync(empty, { recursive: true, force: true })
  })

  it('names a protocol file that exists', () => {
    assert.ok(fs.existsSync(path.join(REPO, ICM_PROTOCOL)), `${ICM_PROTOCOL} no existe`)
  })
})

describe('el prune de harness no borra lo que el Owner escribió', () => {
  // G0 tenía DOS puertas. La primera, prune_unselected_harness_files en
  // setup.sh, se cerró antes. Esta quedó abierta: setup.sh llama a
  // compile-rules --prune inmediatamente después, y hacía rmSync recursivo
  // sobre exactamente las mismas rutas. Reproducido: un CLAUDE.md
  // personalizado y un .agents/skills/mia/SKILL.md propio, los dos borrados.
  const workspace = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-prune-'))
    fs.mkdirSync(path.join(root, 'ref'), { recursive: true })
    return root
  }
  const write = (root, rel, body) => {
    const full = path.join(root, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, body)
    return full
  }

  it('borra lo idéntico al scaffold, que es de AOI', () => {
    const root = workspace()
    write(root, 'CLAUDE.md', 'PRISTINO\n')
    write(root, 'ref/CLAUDE.md', 'PRISTINO\n')

    const kept = prunePathIfPristine(path.join(root, 'CLAUDE.md'), path.join(root, 'ref/CLAUDE.md'))

    assert.equal(fs.existsSync(path.join(root, 'CLAUDE.md')), false)
    assert.deepEqual(kept, [])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('conserva y reporta lo que el Owner cambió', () => {
    const root = workspace()
    write(root, 'CLAUDE.md', 'PRISTINO\n# más mis reglas\n')
    write(root, 'ref/CLAUDE.md', 'PRISTINO\n')

    const kept = prunePathIfPristine(path.join(root, 'CLAUDE.md'), path.join(root, 'ref/CLAUDE.md'))

    assert.equal(fs.existsSync(path.join(root, 'CLAUDE.md')), true, 'borró un archivo editado')
    assert.equal(kept.length, 1)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('conserva un archivo que AOI nunca entregó, dentro de un directorio que sí', () => {
    // El caso que más duele: `rm -rf .agents` arrasaba un árbol entero
    // incluyendo skills que el Owner escribió y que no tienen contraparte.
    const root = workspace()
    write(root, '.agents/rules/aoi-rules.md', 'DE AOI\n')
    write(root, 'ref/.agents/rules/aoi-rules.md', 'DE AOI\n')
    write(root, '.agents/skills/mia/SKILL.md', 'mío\n')

    const kept = prunePathIfPristine(path.join(root, '.agents'), path.join(root, 'ref/.agents'))

    assert.equal(fs.existsSync(path.join(root, '.agents/skills/mia/SKILL.md')), true, 'borró un skill propio')
    assert.equal(fs.existsSync(path.join(root, '.agents/rules/aoi-rules.md')), false, 'no borró lo de AOI')
    assert.equal(kept.length, 1)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('el directorio desaparece solo cuando no queda nada del Owner adentro', () => {
    const root = workspace()
    write(root, '.cursor/rules/aoi.mdc', 'DE AOI\n')
    write(root, 'ref/.cursor/rules/aoi.mdc', 'DE AOI\n')

    prunePathIfPristine(path.join(root, '.cursor'), path.join(root, 'ref/.cursor'))

    assert.equal(fs.existsSync(path.join(root, '.cursor')), false, 'quedó un directorio vacío')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('sin contraparte en el scaffold, no se borra nada', () => {
    // Si no hay con qué comparar, la respuesta segura es conservar.
    const root = workspace()
    write(root, 'AGENTS.md', 'lo que sea\n')

    const kept = prunePathIfPristine(path.join(root, 'AGENTS.md'), path.join(root, 'ref/AGENTS.md'))

    assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), true)
    assert.equal(kept.length, 1)
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('la activación MCP se deriva del protocolo y llega a la superficie generada', () => {
  it('lee los siete grupos que declara el protocolo, y sólo ésos', () => {
    const tools = readMcpActivation(REPO)
    assert.equal(tools.length, 7, `el protocolo declara siete grupos, el lector vio ${tools.length}`)
    for (const t of tools) assert.match(t, /^activate_[a-z_]+$/, `${t} no es un nombre de herramienta`)
    // La misma sección menciona `activate_*` en prosa. No es una octava
    // herramienta, y colarla acá haría que el bloque generado la anunciara.
    assert.ok(!tools.some((t) => t.includes('*')), 'la mención en prosa se coló como herramienta')
  })

  it('el bloque generado nombra cada grupo, para que ningún harness lo pierda', () => {
    const copilot = generateCopilotInstructions({ workspace: 'AOI', repoRoot: REPO })
    for (const t of readMcpActivation(REPO)) {
      assert.ok(copilot.includes(t), `copilot-instructions omitió ${t}`)
    }
  })

  it('degrada a la nada cuando el protocolo no se puede leer', () => {
    // Emitir un bloque a medias sería peor que no emitirlo: un agente que
    // activa tres grupos de siete no sabe que le faltan cuatro.
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-mcp-'))
    assert.deepEqual(readMcpActivation(empty), [])
    assert.equal(renderMcpActivation([]), '')
    assert.doesNotMatch(generateCopilotInstructions({ workspace: 'AOI', repoRoot: empty }), /activate_knowledge/)
    fs.rmSync(empty, { recursive: true, force: true })
  })
})
