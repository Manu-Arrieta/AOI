import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { LEDGER, PROSE_SURFACES, PUBLISHED_DIRS, REQUIRED_CLAIMS, auditClaimsEvidence, claimSurfaces, formatClaimsEvidence, unsupportedClaims } from './claims-evidence-ledger.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const ROOT_WITH_SCAFFOLD = fs.existsSync(path.join(REPO, 'scaffold', 'package.json')) ? REPO : null

test('BIC-2026-006: current public claims are evidence-backed and qualified', (t) => {
  const audit = auditClaimsEvidence(REPO)
  if (!audit.applicable) {
    t.skip('installed workspace without internal claims ledger')
    return
  }
  assert.deepEqual(audit.errors, [])
  assert.ok(audit.scanned >= 5, `only ${audit.scanned} public surfaces were checked`)
})

test('BIC-2026-006: unsupported universal and stale-count claims are rejected', () => {
  const retired = unsupportedClaims('El Gateway reduce hasta un 85%, AOI ofrece memoria infinita y la suite tiene (134 tests).')
  assert.deepEqual(retired, ['universal MCP saving rate', 'fixed test-count claim', 'infinite-memory guarantee'])
})

test('BIC-2026-006: the retired token-saving range matches every form it retired', () => {
  // Esta aserción faltaba, y su ausencia es la razón de que el patrón pudiera
  // quedar muerto: el ledger retiraba `60–90%` (R-001) y el patrón exigía el
  // `%` pegado al 60, así que no matcheaba `saving 60–90% tokens` —la forma que
  // el repositorio realmente usaba— y el claim siguió vivo en una instrucción
  // que se inyecta en todas las fases. Un patrón sin este test se verifica a sí
  // mismo.
  for (const forma of ['saving 60–90% tokens', 'saving 60%–90% tokens', 'ahorro de 60% al 90%', '60% to 90%']) {
    assert.deepEqual(unsupportedClaims(forma), ['universal token-saving range'], forma)
  }
  // Y no marca rangos que nunca se retiraron: un patrón laxo convierte la
  // compuerta en ruido, y el ruido se termina silenciando.
  assert.deepEqual(unsupportedClaims('entre 60% y 70% de los casos'), [])
  assert.deepEqual(unsupportedClaims('ahorra 90% en tests'), [])
})

test('BIC-2026-006: the scan reaches every public, injected, skill and published surface, not a hand-picked list', (t) => {
  // El claim retirado vivía en `.github/instructions/`, fuera del alcance: el
  // patrón lo nombraba y el archivo existía, pero el escaneo no los encontraba
  // con el otro. La propiedad que se fija es la cobertura, no un número.
  //
  // Se extendió el 2026-09-20 al medir que la wiki —desplegada a GitHub Wiki—
  // llevaba 13 claims retirados en 7 de sus 16 archivos con la compuerta en
  // verde: `PUBLISHED_DIRS` no existía. La misma propiedad, un directorio más.
  //
  // La guarda es `t.skip` + `return`, no `assert.fail`: `setup.sh` no instala el
  // ledger interno, así que aguas abajo el audit no aplica y `pnpm test` —el
  // contrato bajo el que AOI shippea— quedaría rojo en TODO workspace instalado.
  // Medido el 2026-09-19 en una instalación real: 581 tests, 1 fallo, mío.
  const audit = auditClaimsEvidence(REPO)
  if (!audit.applicable) {
    t.skip('installed workspace without internal claims ledger')
    return
  }
  // El resolutor es el mismo que usa el audit: cuando cada uno armaba su lista,
  // el test podia quedar conforme con un alcance que el audit no recorria.
  const superficies = claimSurfaces(REPO)
  assert.ok(superficies.length > 30, `solo ${superficies.length} superficies, la lista quedo corta`)
  assert.equal(
    audit.scanned,
    superficies.length,
    `el audit recorrio ${audit.scanned} y el resolutor devuelve ${superficies.length}`
  )

  // Cada familia tiene que estar representada: sacar una es el modo en que este
  // alcance se perdio tres veces —la prosa de `.github/`, la wiki y las skills—.
  const familias = {
    'un README publico en espanol': (s) => s.includes('README.es.md'),
    'la prosa inyectada': (s) => s.some((x) => x.startsWith('.github/instructions/')),
    'los prompts de comando': (s) => s.some((x) => x.startsWith('.github/prompts/')),
    'las skills anidadas': (s) => s.some((x) => /^\.github\/skills\/.+\/SKILL\.md$/.test(x)),
    'la wiki publicada': (s) => s.some((x) => x.startsWith('wiki/')),
  }
  for (const [nombre, presente] of Object.entries(familias)) {
    assert.ok(presente(superficies), `el alcance perdio ${nombre}`)
  }
})

test('BIC-2026-006: a missing claim row cannot turn the ledger green', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-claims-'))
  try {
    const ledgerPath = path.join(root, LEDGER)
    fs.mkdirSync(path.dirname(ledgerPath), { recursive: true })
    fs.writeFileSync(ledgerPath, REQUIRED_CLAIMS.slice(1).map((id) => `| ${id} |`).join('\n'))
    const audit = auditClaimsEvidence(root)
    assert.ok(audit.errors.some((error) => error.includes('C-001')), audit.errors.join('\n'))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('BIC-2026-006: an installed workspace without internal docs skips explicitly', () => {
  const result = formatClaimsEvidence({ applicable: false, errors: [], scanned: 0 })
  assert.equal(result.code, 0)
  assert.match(result.text, /Sin ledger de claims/)
})

test('BIC-2026-006: the ledger gate remains wired into both global test chains', (t) => {
  if (!ROOT_WITH_SCAFFOLD) {
    t.skip('installed scaffold without its AOI source checkout')
    return
  }
  for (const filename of ['package.json', 'scaffold/package.json']) {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT_WITH_SCAFFOLD, filename), 'utf8'))
    assert.match(manifest.scripts['aoi:claims'], /claims-evidence-ledger\.mjs/)
    assert.match(manifest.scripts.test, /pnpm aoi:claims/)
  }
})
