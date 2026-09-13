/**
 * scripts/scaffold/fake-icm.mjs
 *
 * Un `icm` de mentira, para las suites que necesitan el binario y no pueden
 * depender de que esté instalado.
 *
 * POR QUÉ EXISTE, y es un defecto medido con dos días de antigüedad. Dos suites
 * llamaban a `icm` de verdad —`memory-sync` para exportar un bundle, y
 * `sdd-lifecycle` para preguntar por una entidad— y `icm` **no está en el runner
 * de CI**. Las dos pasaban en cualquier máquina que lo tenga instalado, o sea la
 * del que las escribió, y fallaban en CI. Y como la cadena de `pnpm test` usa
 * `&&`, la primera cortó las otras veintiuna: **el CI quedó rojo desde el
 * 2026-09-11 y nadie lo miró**, con veintidós pasos que nunca corrieron.
 *
 * La alternativa era SALTEAR los tests cuando falta `icm`, y se descartó: son la
 * única cobertura del round-trip del CLI y del bloqueo por entidad desconocida,
 * o sea de dos comportamientos que importan. Un skip los apaga en CI para
 * siempre. El stub los mantiene vivos y **hace la dependencia explícita**.
 *
 * Hay una razón más fuerte todavía, y es la que decide: contra el `icm` REAL el
 * resultado dependía de la memoria que hubiera en la base de esa máquina. El
 * test del aislamiento entre workspaces no podía afirmar **qué** entró en el
 * bundle, y el de la entidad desconocida fallaba si alguien tenía una entidad
 * con ese nombre. Un stub fija las dos cosas.
 *
 * Emula los dos subcomandos con la salida del real:
 *
 *   `icm list --all --no-embeddings`  →  bloques `--- <id> ---` con `topic:`
 *   `icm facts list <entidad>`        →  `no facts for <entidad>`, exit 0
 *
 * Lo segundo no es un detalle: `icm` **no usa códigos de salida** para decir que
 * no conoce una entidad, así que el texto es la única señal — y por eso el stub
 * lo reproduce en vez de devolver vacío, que se leería como un contrato sin
 * reglas y no como una consulta sin objeto.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const STUB = [
  '#!/bin/sh',
  'DIR="$(dirname "$0")"',
  'if [ "$1" = "list" ]; then cat "$DIR/list.txt" 2>/dev/null; exit 0; fi',
  'if [ "$1" = "facts" ]; then printf \'no facts for %s\\n\' "$3"; exit 0; fi',
  'exit 1',
  '',
].join('\n')

/**
 * Crea el stub en un directorio temporal.
 *
 * @param {{ topics?: string[] }} [opts] los topics que devuelve `icm list`
 * @returns {{ dir: string, path: string }} `path` es el valor para anteponer al
 *   PATH de un hijo, y también para `process.env.PATH` si el llamador usa el
 *   binario en el proceso actual.
 */
export function fakeIcm({ topics = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-fake-icm-'))

  const blocks = topics
    .map(
      (topic, index) =>
        `--- ${String(index + 1).padStart(24, '0')} ---\n  topic:      ${topic}\n  importance: critical`,
    )
    .join('\n\n')

  fs.writeFileSync(path.join(dir, 'list.txt'), blocks ? `${blocks}\n` : '')
  fs.writeFileSync(path.join(dir, 'icm'), STUB, { mode: 0o755 })

  return { dir, path: `${dir}${path.delimiter}${process.env.PATH}` }
}

/** Borra el stub. Llamalo desde el `after()` del archivo que lo creó. */
export function removeFakeIcm(dir) {
  fs.rmSync(dir, { recursive: true, force: true })
}
