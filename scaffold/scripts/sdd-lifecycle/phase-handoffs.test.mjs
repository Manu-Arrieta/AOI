import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { auditHandoffs, formatHandoffChain, HANDOFFS } from './phase-handoffs.mjs'
import { SDD_PHASES } from './context-budget.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** Builds a throwaway workspace with the given prompt bodies. */
function workspace(prompts) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-handoff-'))
  for (const [rel, body] of Object.entries(prompts)) {
    const full = path.join(root, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, body)
  }
  return root
}

describe('the shipped handoff chain', () => {
  it('closes: every required artifact has an earlier producer', () => {
    const r = auditHandoffs(REPO)
    assert.deepEqual(r.orphanRequires, [], 'una fase exige algo que nadie produce antes')
  })

  it('every declared producer actually says it writes the artifact', () => {
    // Declarar en este archivo que una fase produce algo no lo hace cierto.
    // El prompt tiene que nombrarlo, o la declaración es una ficción cómoda.
    assert.deepEqual(auditHandoffs(REPO).silentProducers, [])
  })

  it('every declared consumer actually says it reads the artifact', () => {
    assert.deepEqual(auditHandoffs(REPO).silentConsumers, [])
  })

  it('covers every phase the budget knows', () => {
    // Una fase nueva sin contrato de traspaso pasaría inadvertida. Se compara
    // contra la lista de fases, no contra un número escrito a mano: el conteo
    // cambia con el ciclo de vida, la correspondencia no.
    assert.deepEqual(
      HANDOFFS.map((h) => h.phase),
      SDD_PHASES.map(([k]) => k),
      'el contrato de traspaso y el presupuesto no cubren las mismas fases'
    )
  })

  it('carries the contract that travels through ICM, not through disk', () => {
    // El BIC es el único handoff que no es un archivo: /sdd-frame lo persiste
    // como facts y el Invariant Gate de /sdd-verify lo lee de ahí. Si esa
    // arista se pierde, la compuerta se queda sin nada que verificar.
    const frame = HANDOFFS.find((h) => h.phase === 'Phase_0_Frame')
    const verify = HANDOFFS.find((h) => h.phase === 'Phase_4_Verify')
    assert.ok(frame.produces.includes('bic-facts'), '/sdd-frame ya no produce el contrato')
    assert.ok(verify.requires.includes('bic-facts'), '/sdd-verify ya no consume el contrato')
  })
})

describe('the audit detects a broken chain', () => {
  it('flags a phase that requires an artifact nobody produces', () => {
    const root = workspace({
      '.github/prompts/a.prompt.md': 'produce nada',
      '.github/prompts/b.prompt.md': 'lee design.md',
    })
    const chain = [
      { phase: 'A', prompt: '.github/prompts/a.prompt.md', produces: [], requires: [] },
      { phase: 'B', prompt: '.github/prompts/b.prompt.md', produces: [], requires: ['design.md'] },
    ]

    assert.equal(auditHandoffs(root, chain).orphanRequires.length, 1)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('flags a producer whose prompt never mentions the artifact', () => {
    // El caso del renombre: el productor pasó a escribir otro nombre y el
    // consumidor sigue pidiendo el viejo. Cada prompt se lee perfecto solo.
    const root = workspace({
      '.github/prompts/a.prompt.md': 'escribe blueprint.md',
      '.github/prompts/b.prompt.md': 'lee design.md',
    })
    const chain = [
      { phase: 'A', prompt: '.github/prompts/a.prompt.md', produces: ['design.md'], requires: [] },
      { phase: 'B', prompt: '.github/prompts/b.prompt.md', produces: [], requires: ['design.md'] },
    ]

    assert.equal(auditHandoffs(root, chain).silentProducers.length, 1)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('flags a consumer whose prompt never mentions what it claims to need', () => {
    const root = workspace({
      '.github/prompts/a.prompt.md': 'escribe design.md',
      '.github/prompts/b.prompt.md': 'no lee nada',
    })
    const chain = [
      { phase: 'A', prompt: '.github/prompts/a.prompt.md', produces: ['design.md'], requires: [] },
      { phase: 'B', prompt: '.github/prompts/b.prompt.md', produces: [], requires: ['design.md'] },
    ]

    assert.equal(auditHandoffs(root, chain).silentConsumers.length, 1)
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('the chain renders for the benchmark', () => {
  it('shows inputs and outputs of every phase', () => {
    const out = formatHandoffChain()
    assert.match(out, /Phase_2_FF.*proposal\.md.*spec\.md/s)
    assert.equal(out.split('\n').length, HANDOFFS.length)
  })

  it('shows the CONDITIONAL artifacts too, not just the hard ones', () => {
    // El display usaba `s.requires`/`s.produces` directo mientras el auditor
    // usaba las listas expandidas, así que la pantalla imprimía
    // `Phase_3_Apply → —` ("no produce nada") mientras el auditor veía su
    // `blueprint-diagrams`. La auditoría lo veía y el reporte lo escondía.
    const out = formatHandoffChain()
    assert.match(out, /Phase_3_Apply.*blueprint-diagrams/, 'el reporte oculta lo que Apply produce condicionalmente')
    assert.match(out, /Phase_4_Verify.*blueprint-diagrams/, 'el reporte oculta lo que Verify exige condicionalmente')
  })

  it('marks conditionals so a hard dependency is distinguishable from one that may not cross', () => {
    const out = formatHandoffChain()
    assert.match(out, /blueprint-diagrams \(si aplica\)/, 'un condicional se lee igual que una dependencia dura')
    // Y lo duro NO lleva la marca: si todo la llevara, no distinguiría nada.
    assert.doesNotMatch(out, /spec\.md \(si aplica\)/)
  })
})

describe('conditional artifacts — cruzan sólo bajo condición', () => {
  it('un condicional no declarado como duro no puede volverse obligatorio', () => {
    // Un diagrama existe si el SBC declaró cruces Y Archify está instalado.
    // Ponerlo en `produces` obligaría a inventar artefactos donde no hay
    // integración — y el gate fallaría en ciclos legítimos.
    const apply = HANDOFFS.find((s) => s.phase === 'Phase_3_Apply')
    assert.deepEqual(apply.produces, [], 'un diagrama se volvió dependencia dura')
    assert.deepEqual(apply.conditionalProduces, ['blueprint-diagrams'])
  })

  it('el consumidor también lo trata como condicional, no como requisito', () => {
    const verify = HANDOFFS.find((s) => s.phase === 'Phase_4_Verify')
    assert.ok(!verify.requires.includes('blueprint-diagrams'), 'el diagrama entró en los requisitos duros')
    assert.ok(verify.conditionalRequires.includes('blueprint-diagrams'))
  })

  it('un condicional declarado sin que el prompt lo nombre igual se detecta', () => {
    // La verificación es la misma que para los duros: si el prompt no lo nombra,
    // la declaración es una ficción cómoda.
    const root = workspace({
      '.github/prompts/a.prompt.md': 'produce nada',
      '.github/prompts/b.prompt.md': 'solo texto sin menciones',
    })
    const chain = [
      { phase: 'A', prompt: '.github/prompts/a.prompt.md', conditionalProduces: ['blueprint-diagrams'] },
      { phase: 'B', prompt: '.github/prompts/b.prompt.md', conditionalRequires: ['blueprint-diagrams'] },
    ]
    const r = auditHandoffs(root, chain)
    assert.equal(r.silentProducers.length, 1, 'no detectó el productor condicional mudo')
    assert.equal(r.silentConsumers.length, 1, 'no detectó el consumidor condicional mudo')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('un condicional presente en el prompt pasa', () => {
    const root = workspace({
      '.github/prompts/a.prompt.md': 'escribe en .blueprints/SBC-1/diagrams/flow.json',
      '.github/prompts/b.prompt.md': 'audita .blueprints/SBC-1/diagrams/',
    })
    const chain = [
      { phase: 'A', prompt: '.github/prompts/a.prompt.md', conditionalProduces: ['blueprint-diagrams'] },
      { phase: 'B', prompt: '.github/prompts/b.prompt.md', conditionalRequires: ['blueprint-diagrams'] },
    ]
    const r = auditHandoffs(root, chain)
    assert.deepEqual(r.silentProducers, [])
    assert.deepEqual(r.silentConsumers, [])
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('orphanProduces — la dirección que faltaba', () => {
  it('detecta un artefacto que una fase produce y ninguna posterior pide', () => {
    // Esta es la dirección que dejó pasar el bug real: los invariantes globales
    // del SBC viajaban a ICM y morían ahí, porque el checker sólo miraba si lo
    // REQUERIDO tenía productor, nunca si lo PRODUCIDO tenía consumidor.
    const root = workspace({
      '.github/prompts/a.prompt.md': 'produce huerfano.txt',
      '.github/prompts/b.prompt.md': 'no pide nada',
    })
    const chain = [
      { phase: 'A', prompt: '.github/prompts/a.prompt.md', produces: ['huerfano.txt'] },
      { phase: 'B', prompt: '.github/prompts/b.prompt.md' },
    ]
    const r = auditHandoffs(root, chain)
    assert.equal(r.orphanProduces.length, 1)
    assert.match(r.orphanProduces[0], /huerfano\.txt/)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('NO reporta huérfano cuando una fase posterior lo consume', () => {
    const root = workspace({
      '.github/prompts/a.prompt.md': 'produce usado.txt',
      '.github/prompts/b.prompt.md': 'lee usado.txt',
    })
    const chain = [
      { phase: 'A', prompt: '.github/prompts/a.prompt.md', produces: ['usado.txt'] },
      { phase: 'B', prompt: '.github/prompts/b.prompt.md', requires: ['usado.txt'] },
    ]
    assert.deepEqual(auditHandoffs(root, chain).orphanProduces, [])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('un condicional consumido tampoco es huérfano', () => {
    // El caso que el fix #5 vino a cerrar: `sbc-facts` lo produce Génesis y lo
    // consumen Frame y Verify. Si la dirección producido→consumidor contara sólo
    // los duros, esto se reportaría como huérfano y el aviso sería ruido.
    const root = workspace({
      '.github/prompts/a.prompt.md': 'escribe sbc.fact',
      '.github/prompts/b.prompt.md': 'lee sbc.fact',
    })
    const chain = [
      { phase: 'A', prompt: '.github/prompts/a.prompt.md', produces: ['sbc-facts'] },
      { phase: 'B', prompt: '.github/prompts/b.prompt.md', conditionalRequires: ['sbc-facts'] },
    ]
    assert.deepEqual(auditHandoffs(root, chain).orphanProduces, [])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('es un AVISO y no un fallo: el flujo real no puede romper por un huérfano legítimo', () => {
    // `registry.md` y los reportes terminales no los pide ninguna fase, y eso es
    // correcto: son documentos vivos o finales que leen humanos.
    const shipped = auditHandoffs(REPO)
    assert.ok(shipped.orphanProduces.length > 0, 'los documentos vivos dejaron de reportarse')
    // Y aun así no son fallo: `main()` sólo sale 1 por orphanRequires/silent*.
    assert.deepEqual(shipped.orphanRequires, [])
    assert.deepEqual(shipped.silentProducers, [])
    assert.deepEqual(shipped.silentConsumers, [])
  })
})

describe('los marcadores de artefacto que no son archivos', () => {
  it('reconoce sbc-facts por su prefijo de clave, no por "icm facts"', () => {
    // La versión anterior aceptaba `icm facts` como señal, y los SIETE prompts
    // del ciclo lo dicen — así que la verificación era vacua y estas dos listas
    // no podían dispararse nunca. Un check que no puede fallar no es un check.
    const root = workspace({ '.github/prompts/a.prompt.md': 'corre icm facts para consultar y nada mas' })
    const r = auditHandoffs(root, [{ phase: 'A', prompt: '.github/prompts/a.prompt.md', produces: ['sbc-facts'] }])
    assert.equal(r.silentProducers.length, 1, 'la verificación volvió a ser vacua')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('un prompt que sí escribe la clave pasa', () => {
    const root = workspace({ '.github/prompts/a.prompt.md': 'icm facts set "WS" "sbc.X.never.1" "..."' })
    const r = auditHandoffs(root, [{ phase: 'A', prompt: '.github/prompts/a.prompt.md', produces: ['sbc-facts'] }])
    assert.deepEqual(r.silentProducers, [])
    fs.rmSync(root, { recursive: true, force: true })
  })
})
