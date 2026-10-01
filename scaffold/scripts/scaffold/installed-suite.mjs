/**
 * scripts/scaffold/installed-suite.mjs
 *
 * Corre la suite de AOI DENTRO de una instalación real, que es el único lugar
 * donde se puede falsar el contrato bajo el que AOI shippea.
 *
 * Existe porque el 2026-09-18 aparecieron seis defectos en un solo día, todos
 * de la misma forma: verdes en el repositorio de desarrollo y rojos en cada
 * workspace instalado. `pnpm test` moría en la compuerta 2 de 26 en TODA
 * instalación, y el repositorio reportaba 13/13 y 21/21 exactamente donde la
 * instalación reportaba ENOENT. Medido: `gate-exit-codes.test.mjs` 13/13 acá,
 * 3 fallos allá; `doctor-checks.test.mjs` 21/21 acá, 1 fallo allá.
 *
 * La causa común fue una sola decisión con radio ancho: el andamio no queda
 * instalado. Todo lo que usaba la PRESENCIA de `scaffold/` como proxy de otra
 * cosa quedó ciego o roto, y sólo aguas abajo.
 *
 * Once tests ya ejecutan `setup.sh`, así que el instalador no es el hueco. El
 * hueco es que ninguno corre `pnpm test` sobre lo que el instalador produjo.
 *
 * Por qué NO es un lint estático sobre quién nombra `scaffold/`: 66 archivos lo
 * nombran y la mayoría vive en `scripts/conf/`, que no se instala y por lo
 * tanto nunca corre aguas abajo. Un lint así reporta ruido y deja pasar el caso
 * que importa. La pregunta "¿esto funciona instalado?" sólo la contesta
 * instalarlo.
 *
 * Deliberadamente NO cuelga de `pnpm test`: cuesta una instalación y un
 * `pnpm install` completos. Es un comando aparte que el protocolo de
 * verificación invoca. Cuesta 0 tokens de inferencia, como toda compuerta acá.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { isDevelopmentRepo } from './governed-paths.mjs'

/**
 * Pasos en orden. Puro y exportado para poder afirmarlo sin pagar la corrida.
 *
 * `icmEnv` va a LOS TRES pasos, no sólo al instalador: `pnpm test` dentro de la
 * instalación también llega a `icm` (provider-store, memory-sync y el guard de
 * memoirs lo ejecutan por nombre), y aislar sólo el primer paso dejaría la misma
 * fuga dos pasos más abajo.
 */
export function planInstalledSuite(repoRoot, workDir, icmEnv = null) {
  const env = icmEnv ? { ...process.env, ...icmEnv } : undefined
  return [
    {
      label: 'install',
      command: 'bash',
      args: [path.join(repoRoot, 'setup.sh'), '--yes', workDir],
      cwd: repoRoot,
      env,
    },
    { label: 'deps', command: 'pnpm', args: ['install'], cwd: workDir, env },
    { label: 'suite', command: 'pnpm', args: ['test'], cwd: workDir, env },
  ]
}

/** El primer ejecutable `name` del PATH, o null. */
export function findExecutable(name, searchPath = process.env.PATH ?? '') {
  for (const dir of searchPath.split(path.delimiter)) {
    if (!dir) continue
    const candidate = path.join(dir, name)
    try {
      fs.accessSync(candidate, fs.constants.X_OK)
      if (fs.statSync(candidate).isFile()) return candidate
    } catch {}
  }
  return null
}

/**
 * El shim de `icm` aislado, tal cual lo escribe `setup.sh`.
 *
 * Se lee del instalador en vez de copiarlo acá: son dos lugares que tienen que
 * aislar con la MISMA regla (`--db` siempre, `icm init` nunca), y una copia que
 * derive reabriría la fuga en uno solo de los dos. Esta compuerta corre
 * únicamente donde `setup.sh` existe, así que leerlo no agrega dependencia.
 */
export function isolatedIcmShim(repoRoot) {
  const setup = fs.readFileSync(path.join(repoRoot, 'setup.sh'), 'utf8')
  const open = "<<'AOI_ICM_SHIM'\n"
  const from = setup.indexOf(open)
  const to = setup.indexOf('\nAOI_ICM_SHIM\n', from)
  if (from === -1 || to === -1) throw new Error('setup.sh ya no define el shim AOI_ICM_SHIM')
  return setup.slice(from + open.length, to + 1)
}

/**
 * Base de ICM y `icm` aislados para una corrida.
 *
 * POR QUÉ: esta compuerta corría `setup.sh` contra el `icm` real. Medido el
 * 2026-09-30: ~35 topics `aoi-*-context` de corridas descartables vivían en la
 * base real del desarrollador, y cada corrida ejecutaba
 * `icm init --mode hook|skill|cli` contra su `~/.claude/`.
 *
 * Devuelve null si no hay `icm` real: sin él no hay a qué reenviar, y el
 * llamador tiene que negarse antes que dejar que el instalador lo instale y
 * escriba en la base global.
 */
export function isolatedIcm(repoRoot, { realIcm = findExecutable('icm') } = {}) {
  if (!realIcm) return null
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-installed-suite-icm-'))
  const bin = path.join(dir, 'bin')
  fs.mkdirSync(bin)
  fs.writeFileSync(path.join(bin, 'icm'), isolatedIcmShim(repoRoot), { mode: 0o755 })
  const db = path.join(dir, 'icm.db')
  return {
    dir,
    db,
    env: {
      PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
      AOI_ICM_DB: db,
      AOI_ICM_REAL: realIcm,
    },
  }
}

/**
 * Un directorio de trabajo bajo el temporal del sistema.
 *
 * Nunca dentro del repositorio: `pnpm install` allí adentro engancharía el
 * workspace del repo y la corrida dejaría de medir una instalación aislada.
 */
export function makeWorkDir(prefix = 'aoi-installed-suite-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

const ejecutar = (step) =>
  spawnSync(step.command, step.args, { cwd: step.cwd, env: step.env, encoding: 'utf8', shell: false })

/**
 * Corre el plan y devuelve el primer paso que falló, o null si pasaron todos.
 * @param {object} opts
 * @param {(step: object) => {status: number|null, stdout?: string, stderr?: string}} [opts.run]
 */
export function runInstalledSuite({ repoRoot, workDir, icmEnv = null, run = ejecutar } = {}) {
  const pasos = planInstalledSuite(repoRoot, workDir, icmEnv)
  const resultados = []
  for (const step of pasos) {
    const r = run(step)
    resultados.push({ label: step.label, status: r.status })
    // Corte al primer fallo: sin instalación no hay nada que testear, y seguir
    // produciría un segundo error derivado que tapa el primero.
    if (r.status !== 0) return { ok: false, failed: step.label, resultados, output: r }
  }
  return { ok: true, failed: null, resultados, output: null }
}

function main() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

  console.log('=== AOI Installed Suite ===')

  if (!isDevelopmentRepo(repoRoot)) {
    // Refusar y no fingir. Sin `setup.sh` no hay nada que instalar, y salir 0
    // callado sería otra compuerta cuyo verde no significa nada.
    console.log('· Workspace instalado: esta compuerta corre desde el repositorio de AOI.')
    process.exit(0)
  }

  const icm = isolatedIcm(repoRoot)
  if (!icm) {
    console.error('❌ No hay `icm` en el PATH: sin él no hay base aislada posible, y el')
    console.error('   instalador lo instalaría y escribiría en la base real. Instalalo primero.')
    process.exit(1)
  }

  const keep = process.argv.includes('--keep')
  const workDir = makeWorkDir()
  console.log(`Instalación bajo prueba: ${workDir}`)
  console.log(`ICM aislado: ${icm.db}`)

  const { ok, failed, resultados, output } = runInstalledSuite({ repoRoot, workDir, icmEnv: icm.env })

  for (const r of resultados) {
    console.log(`  ${r.status === 0 ? '✅' : '❌'} ${r.label} → exit ${r.status}`)
  }

  if (!keep) {
    fs.rmSync(workDir, { recursive: true, force: true })
    fs.rmSync(icm.dir, { recursive: true, force: true })
  } else console.log(`(conservado por --keep: ${workDir} · ${icm.dir})`)

  if (!ok) {
    console.error(`\n❌ La suite de AOI no pasa en una instalación real: falló \`${failed}\`.`)
    if (output?.stdout) console.error(output.stdout.split('\n').slice(-40).join('\n'))
    if (output?.stderr) console.error(output.stderr.split('\n').slice(-20).join('\n'))
    process.exit(1)
  }

  console.log('\n✅ La suite de AOI pasa dentro de una instalación real.')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main()
