#!/usr/bin/env node
/**
 * scripts/archify-path.mjs
 *
 * Imprime la ruta absoluta del renderizador de Archify, o falla si no está.
 *
 * POR QUÉ EXISTE
 *
 * Las fases documentaban el comando como
 * `node "$HOME/.agents/skills/archify/bin/archify.mjs" validate …`, con la ruta
 * escrita a mano. Pero el renderizador puede vivir en cuatro lugares distintos
 * —`~/.agents/skills` o `~/.claude/skills`, con o sin un nivel `archify/` en el
 * medio— y el instalador los resuelve todos. En una máquina donde sólo existe el
 * de `.claude`, la ruta hardcodeada del prompt **fallaba mientras el doctor
 * reportaba PASSED**: la documentación decía una cosa y el sistema hacía otra.
 *
 * Repetir los cuatro candidatos en la prosa de cada fase habría reproducido el
 * mismo defecto con más lugares donde divergir. Así que la resolución vive en un
 * solo lugar —`findArchifyRenderer` en `doctor-checks.mjs`, la misma que usa el
 * doctor— y las fases la invocan.
 *
 * Uso:
 *   ARCHIFY="$(pnpm --silent aoi:archify)" || echo "Archify no instalado"
 *   node "$ARCHIFY" validate sequence candidato.json --quality showcase --json
 *
 * Sale 1 si no lo encuentra, para que un `$(…) ||` en shell lo detecte.
 */

import process from 'node:process'
import { findArchifyRenderer } from './doctor-checks.mjs'

const renderer = findArchifyRenderer()

if (!renderer) {
  console.error('Archify renderer no encontrado. Instalar: bash scripts/install-archify.sh --yes')
  process.exit(1)
}

// Sólo la ruta, sin decoración: el llamador espera hacer `node "$(…)"`.
console.log(renderer)
