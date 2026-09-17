import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SETUP = fs.readFileSync(path.join(REPO, 'setup.sh'), 'utf8')

/**
 * El menú de harness era inalcanzable instalando como está documentado.
 *
 * La condición vieja exigía `[ -z "$RAW_PROJECT_PATH" ]`, o sea que NO se
 * hubiera pasado ruta de proyecto. Pero la ruta es la invocación que el propio
 * encabezado de `setup.sh` documenta, y el instalador se niega a correr sin
 * ella: instalar bien salteaba el menú en silencio y dejaba todo en `all`.
 * Medido: cuatro instalaciones consecutivas reportaron "5 harness adapter(s)
 * active" sin mostrar jamás el prompt.
 *
 * Y usaba `[ -t 0 ]`, el mismo criterio que `specify_stdin_target` abandonó por
 * insuficiente: con stdout hacia un log el operador no VE la pregunta y la
 * espera es un cuelgue.
 *
 * La función se extrae de `setup.sh` y se ejecuta, así que lo que se afirma es
 * el código que corre.
 */
describe('harness_prompt_enabled decide si el operador puede elegir', () => {
  const FN = SETUP.match(/harness_prompt_enabled\(\) \{[\s\S]*?\n\}/)
  assert.ok(FN, 'setup.sh ya no define harness_prompt_enabled()')

  /** Corre la función real: stdin tty, stdout tty, auto-yes, harness explícito. */
  const puedeElegir = (stdinTty, stdoutTty, autoYes, explicit) =>
    execFileSync(
      'bash',
      ['-c', `${FN[0]}; harness_prompt_enabled "$1" "$2" "$3" "$4"`, 'x',
        String(stdinTty), String(stdoutTty), String(autoYes), String(explicit)],
      { encoding: 'utf8' },
    ).trim()

  it('pregunta cuando el operador mira Y puede tipear', () => {
    assert.equal(puedeElegir(1, 1, 0, 0), '1')
  })

  it('NO pregunta si stdout no es terminal, porque nadie vería la pregunta', () => {
    // El cuelgue: el prompt se va al log y el instalador espera para siempre.
    assert.equal(puedeElegir(1, 0, 0, 0), '0')
  })

  it('NO pregunta sin stdin, porque no hay quien conteste', () => {
    assert.equal(puedeElegir(0, 1, 0, 0), '0')
  })

  it('respeta -y: una corrida desatendida no se detiene a preguntar', () => {
    assert.equal(puedeElegir(1, 1, 1, 0), '0')
  })

  it('respeta un --harness explícito, incluso cuando vale "all"', () => {
    // `--harness all` tipeado a propósito era indistinguible del default, y el
    // menú se reabría sobre una elección que el operador ya había hecho.
    assert.equal(puedeElegir(1, 1, 0, 1), '0')
  })

  it('la decisión NO depende de la ruta del proyecto, que es lo que la rompía', () => {
    assert.doesNotMatch(FN[0], /RAW_PROJECT_PATH/, 'la ruta volvió a condicionar el menú')

    const gate = SETUP.match(/if \[ "\$\(harness_prompt_enabled[^\n]*/)
    assert.ok(gate, 'setup.sh ya no usa harness_prompt_enabled para abrir el menú')
    assert.doesNotMatch(gate[0], /RAW_PROJECT_PATH/, 'la compuerta volvió a mirar la ruta')
  })

  it('--harness marca la bandera explícita en las dos formas del flag', () => {
    // Sin esto la bandera queda en 0 y el menú pisa lo que el operador pidió.
    const parser = SETUP.match(/--harness\)\s*\n\s*SELECTED_HARNESS[\s\S]*?--harness=\*\)[\s\S]*?;;/)
    // Anclado a `SELECTED_HARNESS`: hay un segundo parseo de `--harness` antes,
    // el que delega a `setup.ps1` en Git Bash, y no es el que gobierna el menú.
    assert.ok(parser, 'no se encuentra el parseo principal de --harness')
    assert.equal((parser[0].match(/HARNESS_EXPLICIT=1/g) ?? []).length, 2)
  })

  it('captura los hechos del terminal ANTES de la sustitución, o `-t 1` miente', () => {
    // Dentro de `$(...)` la salida estándar ES un pipe, así que un `[ -t 1 ]`
    // escrito ahí adentro devuelve 0 SIEMPRE — incluso con el operador mirando
    // la pantalla — y el menú no se abre nunca. `[ -t 0 ]` sí sobrevive, porque
    // la sustitución sólo redirige stdout: el defecto es asimétrico y por eso
    // fácil de pasar por alto.
    //
    // Los casos de arriba pasaban con el bug presente, porque le inyectan los
    // valores a la función en vez de dejar que el script los mida. Sólo una
    // corrida con un pty en AMBOS descriptores lo destapó: reportaba
    // `stdout=0`. Esta aserción es la que lo habría cazado sin el pty.
    const gate = SETUP.match(/if \[ "\$\(harness_prompt_enabled[^\n]*/)
    assert.ok(gate, 'setup.sh ya no usa harness_prompt_enabled para abrir el menú')
    assert.doesNotMatch(gate[0], /\[ -t 1 \]/, 'el `-t 1` volvió adentro de la sustitución')
    assert.match(gate[0], /"\$STDOUT_IS_TTY"/, 'la compuerta dejó de usar el hecho capturado')
    assert.match(SETUP, /STDOUT_IS_TTY=0; \[ -t 1 \] && STDOUT_IS_TTY=1/, 'nadie captura ya si stdout es terminal')
  })
})

/** Extrae una función de `setup.sh` por nombre, para ejecutar el código real. */
function shellFn(nombre) {
  const m = SETUP.match(new RegExp(`^${nombre}\\(\\) \\{[\\s\\S]*?\\n\\}`, 'm'))
  assert.ok(m, `setup.sh ya no define ${nombre}()`)
  return m[0]
}

const ORDEN = SETUP.match(/^HARNESS_CANONICAL_ORDER="[^"]*"/m)
const NORMALIZE = () => `${ORDEN[0]}\n${shellFn('normalize_harness_selection')}`

/** Corre `normalize_harness_selection` real. Devuelve {out, code}. */
function normalizar(valor) {
  try {
    const out = execFileSync('bash', ['-c', `${NORMALIZE()}; normalize_harness_selection "$1"`, 'x', valor],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { out: out.trim(), code: 0 }
  } catch (e) {
    return { out: (e.stderr ?? '').toString().trim(), code: e.status }
  }
}

describe('normalize_harness_selection da una sola forma a cada elección', () => {
  assert.ok(ORDEN, 'setup.sh ya no declara HARNESS_CANONICAL_ORDER')

  it('ordena canónicamente, y por eso un reinstall no inventa un cambio', () => {
    // El aviso de reinstalación compara la cadena guardada contra la nueva. Sin
    // orden fijo, `claude,copilot` y `copilot,claude` —la MISMA elección— se
    // reportaban como si el operador hubiera cambiado de harness.
    assert.equal(normalizar('claude,copilot').out, 'copilot,claude')
    assert.equal(normalizar('copilot,claude').out, 'copilot,claude')
  })

  it('acepta espacios o comas, en cualquier caja, y deduplica', () => {
    assert.equal(normalizar('CLAUDE , Claude  claude').out, 'claude')
    assert.equal(normalizar('Cline Cursor').out, 'cursor,cline')
  })

  it('colapsa los cinco a "all", que es la misma instalación', () => {
    assert.equal(normalizar('copilot,claude,cursor,antigravity,cline').out, 'all')
    assert.equal(normalizar('all,claude').out, 'all')
  })

  it('una selección vacía es "all", no una instalación sin reglas', () => {
    assert.equal(normalizar('').out, 'all')
  })

  it('RECHAZA un nombre desconocido en vez de ignorarlo', () => {
    // `--harness copilto` no erraba: caía al pruning, que comparaba con `!=`, y
    // un typo de una letra borraba los cinco harness sin decir nada.
    const r = normalizar('copilto')
    assert.notEqual(r.code, 0, 'un harness inexistente ya no detiene la instalación')
    assert.match(r.out, /unknown harness: copilto/)
  })
})

describe('el pruning respeta una selección múltiple', () => {
  const ENTORNO = [
    shellFn('prune_path_if_pristine'),
    shellFn('harness_selected'),
    shellFn('prune_unselected_harness_files'),
    'HARNESS_KEPT=""',
  ].join('\n')

  /** Arma un árbol y su referencia idéntica, prunea, y lista lo que quedó. */
  function podar(seleccion) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-harness-'))
    const archivos = ['CLAUDE.md', 'AGENTS.md', '.clinerules', '.cursorrules', '.github/copilot-instructions.md']
    for (const base of ['target', 'ref']) {
      for (const rel of archivos) {
        const full = path.join(root, base, rel)
        fs.mkdirSync(path.dirname(full), { recursive: true })
        fs.writeFileSync(full, `contenido de ${rel}\n`)
      }
    }

    execFileSync('bash', ['-c',
      `${ENTORNO}; prune_unselected_harness_files "$1/target" "$2" "$1/ref"`, 'x', root, seleccion],
      { encoding: 'utf8' })

    const vivos = archivos.filter((rel) => fs.existsSync(path.join(root, 'target', rel)))
    fs.rmSync(root, { recursive: true, force: true })
    return vivos
  }

  it('deja en pie EXACTAMENTE los harness elegidos', () => {
    // La regresión que esto guarda: el pruning comparaba `[ "$sel" != "claude" ]`
    // contra la cadena entera, así que con `copilot,claude` esa prueba daba
    // verdadera para AMBOS y borraba justo los dos que el operador pidió.
    assert.deepEqual(podar('copilot,claude').sort(),
      ['.github/copilot-instructions.md', 'CLAUDE.md'].sort())
  })

  it('con uno solo se comporta como siempre', () => {
    assert.deepEqual(podar('claude'), ['CLAUDE.md'])
  })

  it('con "all" no toca nada', () => {
    assert.equal(podar('all').length, 5)
  })
})

/**
 * Paridad con el instalador de Windows.
 *
 * PowerShell no se puede EJECUTAR en la máquina donde corre esta suite, así que
 * la cobertura es estática — el mismo trato que `windows-installer-parity`.
 * Vale decirlo sin adornos: esto prueba que el código está escrito, no que
 * corre. Hasta este cambio `setup.ps1` no tenía menú alguno, de modo que quien
 * instalara desde PowerShell jamás pudo elegir harness.
 */
describe('setup.ps1 ofrece la misma elección que setup.sh', () => {
  const PS1 = fs.readFileSync(path.join(REPO, 'setup.ps1'), 'utf8')

  it('declara el mismo orden canónico, o las dos plataformas normalizan distinto', () => {
    const orden = ORDEN[0].match(/"([^"]*)"/)[1].trim().split(/\s+/)
    const declarado = PS1.match(/\$script:HarnessCanonicalOrder = @\(([^)]*)\)/)
    assert.ok(declarado, 'setup.ps1 no declara HarnessCanonicalOrder')
    assert.deepEqual(declarado[1].match(/"([^"]+)"/g).map((s) => s.replaceAll('"', '')), orden)
  })

  it('tiene el menú toggle que Windows no tenía', () => {
    assert.match(PS1, /Select the AI assistants to compile rules for/)
    assert.match(PS1, /\[Y\/n\]/)
  })

  it('no pregunta si la salida está redirigida, porque el prompt no se vería', () => {
    // El mismo criterio que `harness_prompt_enabled`: hacen falta los DOS
    // extremos, o la instalación espera una respuesta que nadie ve que le piden.
    assert.match(PS1, /IsInputRedirected\s*-and\s*-not\s*\[Console\]::IsOutputRedirected/)
  })

  it('prunea por pertenencia, no por comparación de cadena entera', () => {
    assert.match(PS1, /Test-HarnessSelected -Selection \$SelectedHarness -Candidate \$h/)
    assert.doesNotMatch(PS1, /\$h -ne \$SelectedHarness/, 'volvió la comparación que borraba lo elegido')
  })

  it('rechaza un nombre desconocido en vez de ignorarlo', () => {
    assert.match(PS1, /throw "unknown harness: \$item"/)
  })
})
