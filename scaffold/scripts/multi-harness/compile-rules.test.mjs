import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  compileHarnessRules,
  generateAntigravityRules,
  generateClaudeMd,
  generateClineRules,
  generateCopilotInstructions,
  generateCursorRules,
} from './compile-rules.mjs'

describe('multi-harness rules compiler', () => {
  it('generators include mandatory ICM persistent memory rules', () => {
    const claude = generateClaudeMd({ workspace: 'TestWS' })
    assert.ok(claude.includes('icm wake-up'))
    assert.ok(claude.includes('TestWS'))

    const cursor = generateCursorRules({ workspace: 'TestWS' })
    assert.ok(cursor.includes('icm wake-up'))
    assert.ok(cursor.includes('< 300 LOC'))

    const antigravity = generateAntigravityRules({ workspace: 'TestWS' })
    assert.ok(antigravity.includes('ICM Persistent Memory Substrate'))

    const cline = generateClineRules({ workspace: 'TestWS' })
    assert.ok(cline.includes('icm wake-up'))

    const copilot = generateCopilotInstructions({ workspace: 'TestWS' })
    assert.ok(copilot.includes('icm facts set'))
  })

  it('compileHarnessRules compiles target harnesses into filesystem', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-test-'))

    const result = compileHarnessRules(tmpDir, ['claude', 'cursor'], 'TestApp')
    assert.equal(result.compiledFiles.length, 3) // CLAUDE.md, .cursorrules, .cursor/rules/aoi-rules.mdc

    assert.ok(fs.existsSync(path.join(tmpDir, 'CLAUDE.md')))
    assert.ok(fs.existsSync(path.join(tmpDir, '.cursorrules')))
    assert.ok(fs.existsSync(path.join(tmpDir, '.cursor', 'rules', 'aoi-rules.mdc')))

    // All option
    const allResult = compileHarnessRules(tmpDir, ['all'], 'TestApp')
    assert.ok(allResult.compiledFiles.length >= 6)
    assert.ok(fs.existsSync(path.join(tmpDir, '.clinerules')))
    assert.ok(fs.existsSync(path.join(tmpDir, 'AGENTS.md')))
    assert.ok(fs.existsSync(path.join(tmpDir, '.agents', 'rules', 'aoi-rules.md')))

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})

// La prueba de equivalencia que autorizó retirar el espejo `scaffold/` del
// workspace destino (Owner, 2026-09-17: el andamio es lo que se instala, no algo
// que queda instalado).
//
// El pruning necesitaba una referencia prístina para distinguir "esto lo puso
// AOI" de "esto lo escribí yo", y esa referencia era el espejo instalado — la
// única razón por la que tenía que existir en el destino. Sin esa distinción
// desaparecieron un `CLAUDE.md` customizado y un `.agents/skills/mia/SKILL.md`
// del Owner. Ahora la referencia entra por parámetro y es el scaffold de AOI,
// el mismo que `prune_unselected_harness_files` de setup.sh ya usaba.
describe('el pruning protege al Owner sin espejo en el destino', () => {
  const taller = (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-equiv-'))
    const ref = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-ref-'))
    t.after(() => {
      fs.rmSync(root, { recursive: true, force: true })
      fs.rmSync(ref, { recursive: true, force: true })
    })
    fs.writeFileSync(path.join(ref, 'CLAUDE.md'), 'lo que AOI shippea\n')
    fs.writeFileSync(path.join(ref, 'AGENTS.md'), 'lo que AOI shippea\n')
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), 'lo que AOI shippea\n')
    fs.writeFileSync(path.join(root, 'AGENTS.md'), 'MI VERSION EDITADA\n')
    fs.mkdirSync(path.join(root, '.agents/skills/mia'), { recursive: true })
    fs.writeFileSync(path.join(root, '.agents/skills/mia/SKILL.md'), '# mía\n')
    assert.ok(!fs.existsSync(path.join(root, 'scaffold')), 'el destino no tiene espejo')
    return { root, ref }
  }

  it('borra lo prístino de AOI y conserva lo que el Owner tocó o escribió', (t) => {
    const { root, ref } = taller(t)
    compileHarnessRules(root, ['copilot'], 'demo', { prune: true, reference: ref })

    assert.ok(!fs.existsSync(path.join(root, 'CLAUDE.md')), 'lo prístino de AOI debe podarse')
    assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), 'MI VERSION EDITADA\n')
    assert.ok(fs.existsSync(path.join(root, '.agents/skills/mia/SKILL.md')), 'lo del Owner sobrevive')
  })

  // El control negativo. Sin referencia el pruning no tiene con qué comparar, y
  // el único modo de fallo aceptable es NO borrar: borrar a ciegas es el defecto
  // original. Sin esta prueba, un `--reference` olvidado pasaría inadvertido.
  it('sin referencia no borra nada, en vez de borrar a ciegas', (t) => {
    const { root } = taller(t)
    compileHarnessRules(root, ['copilot'], 'demo', { prune: true, reference: path.join(root, 'no-existe') })

    assert.ok(fs.existsSync(path.join(root, 'CLAUDE.md')), 'sin referencia no se puede afirmar que sea de AOI')
    assert.ok(fs.existsSync(path.join(root, '.agents/skills/mia/SKILL.md')))
  })
})
