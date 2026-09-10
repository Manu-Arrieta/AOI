import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { ICM_PROTOCOL, prunePathIfPristine, readStoreTriggers, renderStoreTriggers } from './protocol-source.mjs'
import { generateClaudeMd, generateCopilotInstructions } from './compile-rules.mjs'

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
        assert.ok(text.includes(`\`-i ${level}\` → ${cases}`), `${name} no refleja el nivel ${level}`)
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
