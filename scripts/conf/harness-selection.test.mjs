import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
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
