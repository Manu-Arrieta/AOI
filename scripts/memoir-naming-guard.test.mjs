/**
 * scripts/memoir-naming-guard.test.mjs
 *
 * Dos cosas se fijan acá, y la segunda es la que importa más.
 *
 * La primera es la clasificación: qué nombres cuentan como violación. Los
 * casos salen del censo real de la base compartida, no de nombres inventados —
 * `.github/workflows/aoi-gate.yml` y `@nuxt/image` son conceptos que existen y
 * NO son la erosión que este guard persigue.
 *
 * La segunda es que el guard NUNCA devuelve `FAILED`. Workspaces anteriores al
 * fix arrastran conceptos en kebab que puso AOI mismo; hacer fallar el doctor
 * por datos que creamos nosotros es el mismo error que el instalador que
 * reemplazaba el `pnpm-workspace.yaml` del Owner.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  WORKSPACE_MEMOIR_SUFFIXES,
  checkMemoirNaming,
  classifyConceptName,
  collectNamingViolations,
  parseMemoirExport,
  resolveWorkspaceName,
} from './memoir-naming-guard.mjs'

/**
 * A stand-in for `execFileAsync`. Every check here takes it as a parameter
 * precisely so the guard can be exercised without a real ICM database.
 */
function stubExec({ remote = 'https://github.com/Owner/probe.git', memoirs = {}, icmError = null, requests = [] } = {}) {
  return async (cmd, args) => {
    requests.push([cmd, ...args])
    if (cmd === 'git') {
      if (remote === null) throw new Error('no such remote')
      return { stdout: `${remote}\n` }
    }
    if (cmd === 'icm') {
      if (icmError) throw icmError
      const memoir = args[args.indexOf('-m') + 1]
      const concepts = memoirs[memoir]
      if (!concepts) {
        // Exactly what the real binary does: exit 1 with this text.
        throw Object.assign(new Error('icm memoir export failed'), {
          stdout: `Error: memoir not found: ${memoir}`,
        })
      }
      return {
        stdout: JSON.stringify({
          memoir: { name: memoir },
          concepts: concepts.map((name) => ({ name })),
        }),
      }
    }
    throw new Error(`unexpected command: ${cmd}`)
  }
}

test('la convención es PascalCase: los nombres en kebab del censo son violaciones', () => {
  const violations = [
    'hub-and-spoke',
    'sdd-lifecycle',
    'base-project-map',
    'scaffold-mirror-parity',
    'harness-rule-derivation',
    'dual-sync',
    'risk-management',
    'signal-pipeline',
    'base_project_map',
    'sdd lifecycle',
  ]

  for (const name of violations) {
    assert.equal(classifyConceptName(name), 'violation', `${name} debería ser violación`)
  }
})

test('PascalCase conforma, incluido el caso con guiones', () => {
  for (const name of ['BaseProjectMap', 'Sandbox', 'SandboxCompartment', 'AOI', 'CDA', 'Bwin', 'SDD Lifecycle Engine', 'FQ4-PCIQ']) {
    assert.equal(classifyConceptName(name), 'pascal', `${name} debería conformar`)
  }
})

test('rutas y paquetes scoped quedan fuera: no son la erosión que se persigue', () => {
  // Los dos primeros existen como conceptos reales en memoirs de la base. Una
  // regla ingenua de "todo lo que no sea Pascal es violación" los marcaría, y
  // el guard se volvería ruido en la primera corrida.
  for (const name of ['.github/workflows/aoi-gate.yml', '@nuxt/image', 'iconify', 'dual.sync', '']) {
    assert.equal(classifyConceptName(name), 'other', `${name} no debería clasificarse como violación`)
  }

  assert.equal(classifyConceptName(null), 'other')
  assert.equal(classifyConceptName(undefined), 'other')
})

test('collectNamingViolations recorre memoirs y ordena el resultado', () => {
  const found = collectNamingViolations([
    { name: 'b-architecture', concepts: [{ name: 'ZetaThing' }, { name: 'zona-kebab' }] },
    { name: 'a-architecture', concepts: [{ name: 'alpha-kebab' }, { name: 'AlphaThing' }] },
    { name: 'c-architecture' },
  ])

  assert.deepEqual(found, [
    { memoir: 'a-architecture', name: 'alpha-kebab' },
    { memoir: 'b-architecture', name: 'zona-kebab' },
  ])
})

test('parseMemoirExport devuelve null en vez de explotar', () => {
  assert.equal(parseMemoirExport('no soy json'), null)
  assert.equal(parseMemoirExport(''), null)
  assert.equal(parseMemoirExport(undefined), null)
  assert.equal(parseMemoirExport(JSON.stringify({ memoir: { name: 'x' } })), null)

  const ok = parseMemoirExport(JSON.stringify({ memoir: { name: 'x' }, concepts: [{ name: 'A' }] }))
  assert.equal(ok.name, 'x')
  assert.equal(ok.concepts.length, 1)
})

test('el workspace sale del remoto, no del nombre del directorio', async () => {
  const repoRoot = '/tmp/un-directorio-renombrado'
  const execFn = stubExec({ remote: 'https://github.com/Owner/migarajeapp.git' })

  assert.equal(await resolveWorkspaceName(repoRoot, execFn), 'migarajeapp')
})

test('sin remoto cae al nombre del directorio', async () => {
  const repoRoot = '/tmp/proyecto-sin-remoto'
  const execFn = stubExec({ remote: null })

  assert.equal(await resolveWorkspaceName(repoRoot, execFn), 'proyecto-sin-remoto')
})

test('un workspace sin memoir todavía aprueba: no hay nada que violar', async () => {
  const result = await checkMemoirNaming('/tmp/probe', stubExec())

  assert.equal(result.status, 'PASSED')
  assert.match(result.details, /no workspace memoir yet/)
  assert.deepEqual(result.violations, [])
})

test('un memoir limpio aprueba y reporta cuántos conceptos miró', async () => {
  const result = await checkMemoirNaming(
    '/tmp/probe',
    stubExec({ memoirs: { 'probe-architecture': ['BaseProjectMap', 'Sandbox'] } })
  )

  assert.equal(result.status, 'PASSED')
  assert.match(result.details, /2 concept\(s\) in 1 memoir\(s\)/)
  assert.deepEqual(result.checkedMemoires, ['probe-architecture'])
})

test('un concepto en kebab produce WARNING con el nombre exacto', async () => {
  const result = await checkMemoirNaming(
    '/tmp/probe',
    stubExec({ memoirs: { 'probe-architecture': ['BaseProjectMap', 'hub-and-spoke'] } })
  )

  assert.equal(result.status, 'WARNING')
  assert.match(result.details, /hub-and-spoke/)
  assert.match(result.details, /not in PascalCase/)
  assert.deepEqual(result.violations, [{ memoir: 'probe-architecture', name: 'hub-and-spoke' }])
})

test('el guard NUNCA falla, ni con violaciones ni con ICM roto', async () => {
  // Un FAIL haría que el doctor salga con exit 1 y rompa el workspace del
  // Owner por datos que AOI mismo escribió en instalaciones anteriores.
  const withViolations = await checkMemoirNaming(
    '/tmp/probe',
    stubExec({ memoirs: { 'probe-architecture': ['hub-and-spoke'] } })
  )
  const withBrokenIcm = await checkMemoirNaming(
    '/tmp/probe',
    stubExec({ icmError: new Error('database is locked') })
  )

  assert.notEqual(withViolations.status, 'FAILED')
  assert.notEqual(withBrokenIcm.status, 'FAILED')
})

test('un ICM ilegible se distingue de un workspace sin memoirs', async () => {
  // Los dos casos dejan `read` vacío. Confundirlos reportaría "todo limpio"
  // sobre un grafo que nadie logró abrir.
  const broken = await checkMemoirNaming('/tmp/probe', stubExec({ icmError: new Error('database is locked') }))
  const empty = await checkMemoirNaming('/tmp/probe', stubExec())

  assert.equal(broken.status, 'WARNING')
  assert.match(broken.details, /could not read workspace memoirs/)
  assert.match(broken.details, /database is locked/)
  assert.equal(empty.status, 'PASSED')
})

test('un memoir roto no impide reportar el que sí se pudo leer', async () => {
  const memoirs = { 'probe-architecture': ['hub-and-spoke'] }
  const execFn = async (cmd, args) => {
    if (cmd === 'git') return { stdout: 'https://github.com/Owner/probe.git\n' }
    const memoir = args[args.indexOf('-m') + 1]
    if (memoir === 'probe-domain-model') throw new Error('disk I/O error')
    if (!memoirs[memoir]) {
      throw Object.assign(new Error('nope'), { stdout: `Error: memoir not found: ${memoir}` })
    }
    return { stdout: JSON.stringify({ memoir: { name: memoir }, concepts: memoirs[memoir].map((n) => ({ name: n })) }) }
  }

  const result = await checkMemoirNaming('/tmp/probe', execFn)

  assert.equal(result.status, 'WARNING')
  assert.deepEqual(result.violations, [{ memoir: 'probe-architecture', name: 'hub-and-spoke' }])
})

test('pide exactamente los memoirs del workspace, no los de otros', async () => {
  const requests = []
  await checkMemoirNaming('/tmp/probe', stubExec({ requests }))

  const asked = requests.filter((r) => r[0] === 'icm').map((r) => r[r.indexOf('-m') + 1])

  assert.deepEqual(asked, WORKSPACE_MEMOIR_SUFFIXES.map((s) => `probe${s}`))
  // El nombre pelado del workspace también se mira: en la base hay memoirs
  // creados así (`AOI`, `MoviHub`), no sólo con sufijo.
  assert.ok(asked.includes('probe'))
})
