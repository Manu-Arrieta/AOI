/**
 * scripts/sdd-lifecycle/harness-bands.test.mjs
 *
 * El piso que el presupuesto publica cuenta `.github/skills` y
 * `.github/instructions`: es la factura del harness Copilot/Claude. Antigravity
 * no lee ninguna de las dos — `compile-rules` lo mapea a `.agents/`, donde las
 * skills se DERIVAN de las instructions y por eso pesan más a propósito.
 *
 * Mientras nadie reportara esa segunda banda, un ciclo que recortó
 * `.github/skills` un 25% mientras `.agents/skills` crecía un 27% se leía como
 * ahorro puro. Lo era para un harness. Publicar un solo número para un producto
 * multi-harness es la misma clase de error que publicar un techo como si fuera
 * un piso, que este proyecto ya corrigió una vez.
 *
 * Aritmética estática sobre archivos en disco: 0 tokens de inferencia.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { formatHarnessBands, harnessSkillBands } from './context-budget.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('harnessSkillBands', () => {
  it('mide las dos bandas del repositorio, no una sola', () => {
    const b = harnessSkillBands(REPO)

    assert.ok(b.github > 0, 'no midió la banda de Copilot/Claude')
    assert.ok(b.agents > 0, 'no midió la banda de antigravity: vuelve a ser invisible')
  })

  it('una banda ausente es un cero honesto, no una excepción', () => {
    // Un harness puede no estar instalado. Eso se reporta como cero; lo que no
    // puede pasar es que el instrumento se caiga y deje de reportar el resto.
    const vacio = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-bandas-'))

    assert.deepEqual(harnessSkillBands(vacio), { github: 0, agents: 0 })
  })

  it('cuenta cada fase en la que la skill se carga, no el archivo una vez', () => {
    // Una skill de alcance universal se paga en las seis fases. Contarla una
    // sola vez es exactamente cómo 21.572 tokens pasaron años sin medirse.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-bandas-'))
    const cuerpo = 'x'.repeat(400)
    for (const dir of ['.github/skills/icm', '.agents/skills/icm']) {
      fs.mkdirSync(path.join(root, dir), { recursive: true })
      fs.writeFileSync(path.join(root, dir, 'SKILL.md'), cuerpo)
    }
    const b = harnessSkillBands(root)

    assert.equal(b.github, b.agents)
    assert.equal(b.github, Math.ceil(cuerpo.length / 4) * 6, 'no aplicó el multiplicador de las seis fases')
  })
})

describe('formatHarnessBands', () => {
  it('nombra a los dos harness, su banda y la diferencia', () => {
    const texto = formatHarnessBands({ github: 16172, agents: 27518 })

    assert.match(texto, /\.github\/skills/)
    assert.match(texto, /\.agents\/skills/)
    assert.match(texto, /16,172/)
    assert.match(texto, /27,518/)
    assert.match(texto, /\+11,346/)
  })

  it('no esconde el signo cuando la banda de antigravity es la más barata', () => {
    assert.match(formatHarnessBands({ github: 20000, agents: 12000 }), /-8,000/)
  })
})
