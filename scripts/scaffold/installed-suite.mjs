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

/** Pasos en orden. Puro y exportado para poder afirmarlo sin pagar la corrida. */
export function planInstalledSuite(repoRoot, workDir) {
  return [
    {
      label: 'install',
      command: 'bash',
      args: [path.join(repoRoot, 'setup.sh'), '--yes', workDir],
      cwd: repoRoot,
    },
    { label: 'deps', command: 'pnpm', args: ['install'], cwd: workDir },
    { label: 'suite', command: 'pnpm', args: ['test'], cwd: workDir },
  ]
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
  spawnSync(step.command, step.args, { cwd: step.cwd, encoding: 'utf8', shell: false })

/**
 * Corre el plan y devuelve el primer paso que falló, o null si pasaron todos.
 * @param {object} opts
 * @param {(step: object) => {status: number|null, stdout?: string, stderr?: string}} [opts.run]
 */
export function runInstalledSuite({ repoRoot, workDir, run = ejecutar } = {}) {
  const pasos = planInstalledSuite(repoRoot, workDir)
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

  const keep = process.argv.includes('--keep')
  const workDir = makeWorkDir()
  console.log(`Instalación bajo prueba: ${workDir}`)

  const { ok, failed, resultados, output } = runInstalledSuite({ repoRoot, workDir })

  for (const r of resultados) {
    console.log(`  ${r.status === 0 ? '✅' : '❌'} ${r.label} → exit ${r.status}`)
  }

  if (!keep) fs.rmSync(workDir, { recursive: true, force: true })
  else console.log(`(conservado por --keep: ${workDir})`)

  if (!ok) {
    console.error(`\n❌ La suite de AOI no pasa en una instalación real: falló \`${failed}\`.`)
    if (output?.stdout) console.error(output.stdout.split('\n').slice(-40).join('\n'))
    if (output?.stderr) console.error(output.stderr.split('\n').slice(-20).join('\n'))
    process.exit(1)
  }

  console.log('\n✅ La suite de AOI pasa dentro de una instalación real.')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main()
