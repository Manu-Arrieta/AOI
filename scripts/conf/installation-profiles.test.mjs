import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const POSIX = fs.readFileSync(path.join(REPO, 'setup.sh'), 'utf8')
const WINDOWS = fs.readFileSync(path.join(REPO, 'setup.ps1'), 'utf8')
const SNAPSHOT = fs.readFileSync(path.join(REPO, 'scripts/conf/snapshot-conf.sh'), 'utf8')
const PACKAGE = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'))
const README = fs.readFileSync(path.join(REPO, 'README.md'), 'utf8')
const EXTERNAL_SMOKE_ES = fs.readFileSync(path.join(REPO, 'docs/internal/verification/external-smoke-plan.es.md'), 'utf8')
const EXTERNAL_SMOKE_EN = fs.readFileSync(path.join(REPO, 'docs/internal/verification/external-smoke-plan.md'), 'utf8')

test('BIC-2026-005: both installer entry points expose the same closed profile contract', () => {
  assert.match(POSIX, /export INSTALLATION_PROFILE="core"/)
  assert.match(POSIX, /--profile\)/)
  assert.match(POSIX, /core\) ;;/)
  assert.match(POSIX, /advanced\) PROFILE_INCLUDES_ADVANCED=1/)
  assert.match(POSIX, /dashboard\) PROFILE_INCLUDES_ADVANCED=1; PROFILE_INCLUDES_DASHBOARD=1/)
  assert.match(WINDOWS, /\[ValidateSet\("core", "advanced", "dashboard"\)\]/)
  assert.match(WINDOWS, /\[string\]\$Profile = "core"/)
})

test('BIC-2026-005: Core prevents new dashboard copies without deleting an existing one', () => {
  assert.match(POSIX, /SCAFFOLD_COPY_EXCLUDE\+=\("--exclude=aoi_apps\/"\)/)
  assert.match(POSIX, /profile_excludes_relative_path "\$file" && continue/)
  assert.match(WINDOWS, /function Test-InstallationProfileExcludedPath/)
  assert.match(WINDOWS, /-ExcludedRelativePrefixes \$ProfileExcludedRelativePrefixes/)

  // The safety property is directional: a Core selection may skip future AOI
  // copies but must never clean a dashboard an owner already has.
  assert.doesNotMatch(POSIX, /rm -rf "\$PROJECT_PATH\/aoi_apps/)
  assert.doesNotMatch(WINDOWS, /Remove-Item[^\n]*aoi_apps\\agentic-ops-dashboard/)
})

// Este test se llamaba "Advanced is the sole path that installs its
// integrations" y afirmaba de Codebase Memory exactamente lo mismo que de
// Headroom. El Owner zanjó el 2026-09-17 que Codebase Memory es obligatorio en
// TODOS los perfiles y que Headroom es la única herramienta de ahorro opcional
// de AOI, así que la premisa era falsa para la mitad de lo que verificaba — y
// el test la sostenía, de modo que corregir el instalador rompía la suite.
test('BIC-2026-005: Headroom es la única integración que un perfil puede omitir', () => {
  assert.match(POSIX, /if \[ "\$PROFILE_INCLUDES_ADVANCED" -eq 1 \]; then\nheader "Phase 1\.6: Headroom/)
  assert.match(WINDOWS, /if \(\$ProfileIncludesAdvanced\) \{\nWrite-Header "Phase 1\.6: Headroom/)
  assert.match(POSIX, /Core profile: la integración Headroom/)
  assert.match(WINDOWS, /Core profile: la integración Headroom/)
})

test('BIC-2026-005: Codebase Memory se instala en todo perfil y su fallo es fatal', () => {
  // Incondicional: el bloque abre con `if` a nivel superior, no con un `elif`
  // colgado de un chequeo de perfil, y el fallo del instalador hijo corta.
  assert.match(POSIX, /\nif \[\[ -f "\$SCRIPT_DIR\/scripts\/install-codebase-memory\.sh" \]\]; then[\s\S]*?if ! bash "\$SCRIPT_DIR\/scripts\/install-codebase-memory\.sh"[\s\S]*?exit 1/)
  assert.match(WINDOWS, /\nWrite-Header "Phase 1\.8: Codebase Memory MCP"/)
  assert.match(WINDOWS, /\$codebaseMemoryInstall[\s\S]*?catch \{[\s\S]*?exit 1/)

  // Los controles negativos, y son el punto. Sin ellos las aserciones de arriba
  // las satisface igual un instalador que siga gateando Codebase Memory por
  // perfil: fue exactamente esa forma la que dejó al perfil por defecto —el
  // único alcanzable sin bandera— sin una herramienta declarada obligatoria.
  assert.doesNotMatch(POSIX, /if \[ "\$PROFILE_INCLUDES_ADVANCED" -eq 0 \]; then\n\s*info "Core profile: Codebase Memory/)
  assert.doesNotMatch(POSIX, /Core profile: Codebase Memory MCP is not installed/)
  assert.doesNotMatch(POSIX, /elige --profile core/)
  assert.doesNotMatch(WINDOWS, /Core profile: advanced Headroom integration and Codebase Memory MCP are not installed/)
  assert.doesNotMatch(WINDOWS, /Selecciona -Profile core para no instalarlo/)
})

test('BIC-2026-005: profile persists before dashboard-safe commands inspect it', () => {
  assert.match(SNAPSHOT, /"installation_profile": "\$INSTALLATION_PROFILE"/)
  assert.match(POSIX, /"0\.1\.x" "\$INSTALLATION_PROFILE"/)
  assert.match(WINDOWS, /\$confAction "0\.1\.x" \$Profile/)
  for (const name of ['dev:dashboard', 'build:dashboard', 'preview:dashboard', 'prepare:dashboard', 'test:dashboard']) {
    assert.match(PACKAGE.scripts[name], /dashboard-command\.mjs/)
    assert.doesNotMatch(PACKAGE.scripts[name], /cd aoi_apps/)
  }
})

test('BIC-2026-005: install and external-smoke guidance preserve the Core-default contract', () => {
  assert.match(README, /`core` es el perfil predeterminado/)
  assert.match(README, /--profile advanced/)
  assert.match(README, /--profile dashboard/)
  assert.match(README, /Está incluido en los perfiles `advanced` y `dashboard`/)

  for (const smokePlan of [EXTERNAL_SMOKE_ES, EXTERNAL_SMOKE_EN]) {
    assert.match(smokePlan, /setup\.sh" --profile core/)
    assert.match(smokePlan, /-Profile core/)
    assert.match(smokePlan, /--profile dashboard/)
    assert.match(smokePlan, /-Profile dashboard/)
  }
})

// Un instalador no emite dos veces la misma fase.
//
// El 2026-09-17 `cb22dc0` dejó `setup.ps1` con la sentencia `if ($answer
// -notmatch '...` abierta y las 650 líneas del cuerpo COMPLETO del instalador
// empalmadas adentro: el archivo pasó de 1672 a 2411 líneas y cada fase, de
// `Phase 1: Tools` a `Phase 7`, quedó duplicada. El instalador de Windows no
// parseaba.
//
// Ninguna suite lo vio. Las tres que leen `setup.ps1` —ésta incluida— lo hacen
// con `assert.match`, y un duplicado matchea exactamente igual de bien que el
// original: doce tests en verde sobre un archivo roto. Contar es la pregunta
// que `match` no puede hacer.
test('BIC-2026-005: ningún instalador emite la misma fase dos veces', () => {
  const duplicadas = (fuente, patron) => {
    const cuenta = new Map()
    for (const m of fuente.matchAll(patron)) {
      const fase = m[1].trim()
      cuenta.set(fase, (cuenta.get(fase) ?? 0) + 1)
    }
    return [...cuenta.entries()].filter(([, n]) => n > 1).map(([fase, n]) => `${fase} ×${n}`)
  }

  assert.deepEqual(duplicadas(WINDOWS, /Write-Header "(Phase [^"]+)"/g), [])
  assert.deepEqual(duplicadas(POSIX, /^header "(Phase [^"]+)"/gm), [])

  // El banner de entrada delimita una corrida. Dos bannres son dos corridas.
  const banners = WINDOWS.match(/Write-Header "AOI → \$ProjectName"/g) ?? []
  assert.equal(banners.length, 1, `setup.ps1 abre ${banners.length} corridas`)
})

// El perfil dashboard nunca funcionó en macOS, y nadie lo supo hasta que se
// instaló uno de verdad el 2026-09-17.
//
// `SCAFFOLD_COPY_EXCLUDE` queda vacío exactamente cuando el perfil incluye
// dashboard. macOS trae bash 3.2.57 y `env bash` resuelve a `/bin/bash`; bash
// anterior a 4.4 trata `"${ARR[@]}"` sobre un array vacío bajo `set -u` como
// variable no ligada. La corrida moría en Phase 3 con
// `SCAFFOLD_COPY_EXCLUDE[@]: unbound variable`.
//
// La aserción es TEXTUAL a propósito. En bash 4.4+ la forma sin blindar no
// falla, así que un test que ejecutara el instalador pasaría en cualquier
// máquina moderna y callaría justo sobre la plataforma donde rompe.
test('BIC-2026-005: toda expansión de SCAFFOLD_COPY_EXCLUDE sobrevive a bash 3.2', () => {
  // La forma blindada `${ARR[@]+"${ARR[@]}"}` expande a NADA con el array
  // vacío; la desnuda `"${ARR[@]}"` es la que aborta. Se afirma la propiedad y
  // no un conteo: fijar "son 6" obligaba a tocar el test cada vez que una
  // expansión nace o muere, y el número no es lo que protege a nadie.
  const desnudas = POSIX.match(/(?<!\+)"\$\{SCAFFOLD_COPY_EXCLUDE\[@\]\}"/g) ?? []
  assert.deepEqual(desnudas, [], 'una expansión sin blindar aborta el perfil dashboard en macOS')

  const blindadas = POSIX.match(/\$\{SCAFFOLD_COPY_EXCLUDE\[@\]\+"\$\{SCAFFOLD_COPY_EXCLUDE\[@\]\}"\}/g) ?? []
  assert.ok(blindadas.length > 0, 'el array debe seguir usándose, y blindado')
})
