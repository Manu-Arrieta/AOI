/**
 * scripts/sdd-lifecycle/workspace-identity.mjs
 *
 * Resuelve el nombre del workspace —la entidad de ICM que el ciclo SDD usa para
 * leer los hechos `bic.*`— sin que nadie lo escriba a mano.
 *
 * Por qué existe. La única invocación del Invariant Gate que no pasaba
 * `--entity` era el alias `aoi:invariant-gate` de `package.json`, y moría con
 * exit 2 (`provide --entity <WORKSPACE>`) sin poder auditar nada. Eso no era un
 * defecto cosmético: el alias tampoco llevaba `--exit-code`, así que aun
 * resolviendo la entidad habría reportado FAILED y salido 0. Las dos cosas
 * juntas son las que hacen que un gate pueda bloquear.
 *
 * La regla es la misma que fija `.github/instructions/icm-protocol.instructions.md`:
 * `git remote basename` con prioridad, `basename` del directorio como respaldo.
 * Vive acá y no duplicada a propósito — dos implementaciones del mismo cálculo
 * divergen siempre; la pregunta es cuándo.
 */

import { execFileSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

/**
 * El basename del remoto `origin`, o `''` cuando no hay remoto.
 *
 * Cubre las tres formas en que un remoto aparece: `git@host:org/repo.git`,
 * `https://host/org/repo.git` y la variante sin `.git` ni barra final.
 *
 * @param {string} cwd
 * @returns {string}
 */
export function workspaceFromGitRemote(cwd = process.cwd()) {
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (!url) return ''
    return path.basename(url).replace(/\.git$/, '')
  } catch {
    // Repositorio sin remoto, sin git, o git que no responde: el respaldo es la
    // respuesta, no un error. Un gate que no puede auditar porque no pudo
    // adivinar un nombre no está fallando cerrado, está fallando por nada.
    return ''
  }
}

/**
 * Resuelve la entidad y **declara de dónde salió**.
 *
 * `source` y `notice` no son decorativos. Auditar la entidad equivocada es
 * indistinguible de aprobar: una entidad sin hechos `bic.*` da `SKIPPED`, y
 * `SKIPPED` sale 0. Quien lea el resultado tiene que poder ver qué se auditó y
 * con qué criterio, o el gate se vuelve un pase silencioso con más pasos.
 *
 * @param {string} cwd
 * @returns {{ entity: string, source: string, notice: string }}
 */
export function resolveWorkspaceEntity(cwd = process.cwd()) {
  const fromRemote = workspaceFromGitRemote(cwd)
  const entity = fromRemote || path.basename(cwd)
  const source = fromRemote
    ? 'git remote origin'
    : `basename del directorio "${path.basename(cwd)}" (sin remoto origin)`

  return {
    entity,
    source,
    notice: `Invariant Gate: entidad auto-resuelta "${entity}" desde ${source}.\n`,
  }
}
