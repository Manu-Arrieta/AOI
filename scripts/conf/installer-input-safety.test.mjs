/**
 * scripts/conf/installer-input-safety.test.mjs
 *
 * Four small ways the installer misbehaved: three that destroyed something the
 * operator owns, and one that hung. Each was cheap to fix and each was able to
 * cost the operator something they cannot get back — time included.
 *
 *   - `eval echo "$PROJECT_PATH"` expanded the leading tilde, and every other
 *     shell construct in the string with it. A path typed or pasted as
 *     `/tmp/$(rm -rf ~/algo)x` ran the command before the installer had even
 *     checked the directory existed.
 *   - `rm -f .windsurfrules` ran unconditionally, to clean up a file
 *     `icm init --mode cli` may leave behind. After the fact nothing can tell
 *     ICM's file from one the owner wrote, so a Windsurf user lost their rules
 *     on every install.
 *   - The hook backup overwrote an existing `.aoi-bak`, discarding the
 *     ORIGINAL hook AOI first displaced in favour of whatever replaced it.
 *     (The wiring itself now lives in `install-git-guard.mjs` — it used to sit
 *     inside `setup.sh`'s advanced-only branch, so a `core` install got the
 *     guard script and never the hook. The invariant moved with it.)
 *   - `specify init` ran with stdin inherited. `2>/dev/null` hides the error
 *     output, not the input: with no terminal behind it, the prompt waited for
 *     an answer nobody could give. Measured: 6:44 hung on a headless run, with
 *     the prompt writing to /dev/ttys012 — outside the log, so the hang stayed
 *     invisible until someone looked at the terminal.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SETUP = fs.readFileSync(path.join(REPO, 'setup.sh'), 'utf8')
const GUARD_INSTALLER = fs.readFileSync(
  path.join(REPO, 'scripts/multi-harness/install-git-guard.mjs'),
  'utf8'
)

/** Non-comment lines of the installer. */
const live = SETUP.split('\n').filter((l) => !/^\s*#/.test(l))

describe('the installer does not run what the operator typed', () => {
  it('expands the tilde without eval', () => {
    assert.deepEqual(live.filter((l) => /\beval\s+echo\b/.test(l)), [])
    assert.match(SETUP, /case "\$PROJECT_PATH" in\n\s*"~"\)/)
  })

  it('the replacement expands ~ and executes nothing', (t) => {
    // Exercised through bash so the claim is about the shell, not the regex.
    const script = `
      PROJECT_PATH="$1"
      case "$PROJECT_PATH" in
        "~") PROJECT_PATH="$HOME" ;;
        "~/"*) PROJECT_PATH="$HOME/\${PROJECT_PATH#\\~/}" ;;
      esac
      printf '%s' "$PROJECT_PATH"
    `
    const run = (arg) => execFileSync('bash', ['-c', script, 'x', arg], { encoding: 'utf8', env: { ...process.env, HOME: '/casa' } })

    assert.equal(run('~'), '/casa')
    assert.equal(run('~/proyecto'), '/casa/proyecto')

    const markerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-eval-'))
    // El marcador tiene que sobrevivir al assert para poder comprobar que NO se
    // creó, así que el directorio se borra recién al cerrar el test. Medido: 3
    // directorios por corrida sin esto.
    t.after(() => fs.rmSync(markerDir, { recursive: true, force: true }))
    const marker = path.join(markerDir, 'pwned')
    const hostile = `/tmp/$(touch ${marker})x`
    assert.equal(run(hostile), hostile, 'la ruta se transformó, así que algo la expandió')
    assert.equal(fs.existsSync(marker), false, 'se ejecutó el comando embebido en la ruta')
  })
})

describe('the installer only removes what it created', () => {
  it('decides about .windsurfrules before icm runs, not after', () => {
    assert.match(SETUP, /WINDSURFRULES_PREEXISTING=0/)
    // The check has to precede `icm init --mode cli`; afterwards the file's
    // provenance is unknowable.
    // Sólo líneas ejecutables: el comentario que explica el arreglo también
    // nombra `icm init --mode cli` y adelantaría el índice.
    const guardAt = live.findIndex((l) => l.includes('WINDSURFRULES_PREEXISTING=0'))
    const icmAt = live.findIndex((l) => l.includes('icm init --mode cli'))
    assert.ok(guardAt >= 0 && icmAt >= 0)
    assert.ok(guardAt < icmAt, 'la comprobación quedó después de que icm pudo crear el archivo')
    // El borrado sigue existiendo, y debe: lo que importa es que esté
    // gobernado por la comprobación previa y no colgando suelto.
    const rmAt = live.findIndex((l) => /rm -f "\$PROJECT_PATH\/\.windsurfrules"/.test(l))
    assert.ok(rmAt > icmAt, 'el borrado no está después de icm init')
    assert.match(live[rmAt - 1], /if \[ "\$WINDSURFRULES_PREEXISTING" -eq 0 \]/)
  })

  it('never discards an existing hook backup', () => {
    // Asserted against the wiring's new owner. This used to read `setup.sh`,
    // and moving the target is the point: the invariant is about the ORDER of
    // two operations — preserve the earlier backup BEFORE displacing the
    // current hook — and it has to hold wherever the wiring lives. Reading the
    // old file after the move would have left the invariant untested while
    // still looking asserted.
    const idx = GUARD_INSTALLER.indexOf('fs.renameSync(hook, bak)')
    assert.ok(idx > 0, 'no se encontró el respaldo del hook existente')
    const before = GUARD_INSTALLER.slice(0, idx)
    assert.match(before, /if \(fs\.existsSync\(bak\)\) \{/)
    assert.match(before, /fs\.renameSync\(bak,/)
  })
})

/**
 * Un comando que pregunta algo que nadie puede contestar no falla: se queda.
 * Por eso esto es un defecto y no una molestia — el modo de falla es esperar
 * para siempre, y el instalador se declara autónomo.
 */
describe('the installer cannot hang on a question nobody can answer', () => {
  const INVOCATION = /\bspecify\s+init\b/

  it('invoca specify init sin heredar stdin', () => {
    // Sólo líneas ejecutables que realmente invocan el comando: los
    // `warn`/`info` lo nombran dentro de un mensaje y ahí no hay nada que
    // redirigir. Sin este filtro el test exigiría redirección en una cadena.
    const invocations = live.filter((l) => INVOCATION.test(l) && !/^\s*(warn|info|err|echo)\b/.test(l))
    assert.ok(
      invocations.length > 0,
      'el barrido no encontró ninguna invocación — el test dejaría de probar nada en silencio',
    )
    for (const line of invocations) {
      assert.match(
        line,
        /<"\$SPECIFY_STDIN"|<\/dev\/null/,
        `specify init hereda stdin y puede colgarse: ${line.trim()}`,
      )
    }
  })

  it('demuestra el cuelgue: stdin que nunca cierra deja a specify esperando', (t) => {
    const dir = fakeSpecifyThatAsks(t)
    // `sleep 30 |` da un stdin que no entrega datos ni cierra: un pipe, no un
    // terminal. Sin `timeout` este test colgaría la suite — que es el punto.
    assert.throws(
      () =>
        execFileSync('bash', ['-c', 'sleep 30 | specify init . --ai copilot --force'], {
          encoding: 'utf8',
          cwd: dir,
          env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
          timeout: 1500,
        }),
      (err) => err.code === 'ETIMEDOUT' || /timed out/i.test(String(err.message)),
      'sin redirección el comando NO se colgó — el defecto que este test documenta ya no existe',
    )
  })

  it('el fix lo evita: con /dev/null el mismo comando termina', (t) => {
    const dir = fakeSpecifyThatAsks(t)
    const out = execFileSync(
      'bash',
      ['-c', 'specify init . --ai copilot --force </dev/null; echo TERMINO'],
      {
        encoding: 'utf8',
        cwd: dir,
        env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
        timeout: 5000,
      },
    )
    assert.match(out, /TERMINO/)
  })
})

/**
 * La DECISIÓN, que es donde vivía el bug.
 *
 * Los dos casos de arriba fijan el mecanismo —"un stdin que no cierra cuelga,
 * /dev/null lo termina"— y con eso solo el bug pasó inadvertido una release
 * entera. La corrida que de verdad se cuelga no tiene stdin cerrado: tiene
 * stdin apuntando al terminal del operador y STDOUT redirigido al log. El
 * criterio viejo (`[ -t 0 ]`) elegía /dev/tty justo ahí, o sea el mismo
 * terminal que ya se heredaba: cambiar un tty por el mismo tty no arregla
 * nada, y el test seguía verde porque probaba un pipe.
 *
 * La función se extrae del propio `setup.sh` y se ejecuta, así que lo que se
 * afirma es el código que corre, no una copia paralela.
 */
describe('specify_stdin_target decide por lo que el operador puede ver', () => {
  const FN = SETUP.match(/specify_stdin_target\(\) \{[\s\S]*?\n\}/)
  assert.ok(FN, 'setup.sh ya no define specify_stdin_target()')

  /** Ejecuta la función real con los dos hechos como enteros. */
  const decide = (stdinTty, stdoutTty) =>
    execFileSync(
      'bash',
      ['-c', `${FN[0]}; specify_stdin_target "$1" "$2"`, 'x', String(stdinTty), String(stdoutTty)],
      { encoding: 'utf8' },
    )

  it('libera la entrada cuando stdout NO es un terminal', () => {
    // El caso que se colgaba: el operador no ve el prompt, así que esperar su
    // respuesta es esperar para siempre.
    assert.equal(decide(1, 0), '/dev/null')
  })

  it('la deja preguntar sólo si el operador mira Y puede tipear', () => {
    assert.equal(decide(1, 1), '/dev/tty')
  })

  it('libera la entrada si falta cualquiera de los dos', () => {
    // Sin stdin no hay quien tipee; sin stdout no hay quien lea la pregunta.
    // Cualquiera de los dos que falte convierte la espera en un cuelgue, así
    // que la única respuesta segura es EOF.
    assert.equal(decide(0, 1), '/dev/null')
    assert.equal(decide(0, 0), '/dev/null')
  })

  it('setup.sh usa la decisión en vez de preguntar por un solo descriptor', () => {
    // El bug no fue el valor elegido: fue el CRITERIO. Un `[ -t 0 ]` suelto
    // vuelve a elegir /dev/tty en la corrida que se cuelga.
    assert.match(SETUP, /SPECIFY_STDIN="\$\(specify_stdin_target /)
    assert.doesNotMatch(SETUP, /if \[ -t 0 \]; then\n\s*SPECIFY_STDIN=\/dev\/tty/)
  })
})

/**
 * Un `specify` falso que pregunta igual que el real. Devuelve su directorio y
 * lo borra al cerrar el test: sin eso quedan 4 por corrida.
 * @param {import('node:test').TestContext} t
 */
function fakeSpecifyThatAsks(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-specify-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  fs.writeFileSync(
    path.join(dir, 'specify'),
    '#!/usr/bin/env bash\nread -r -p "overwrite? " ans\nprintf "%s" "$ans"\n',
    { mode: 0o755 },
  )
  return dir
}

/**
 * `set -euo pipefail` es global en el instalador. Una invocación como comando
 * suelto aborta el script en cuanto el hijo sale distinto de cero, y el `rm` de
 * la línea siguiente no corre nunca. Para el sanitizer de PowerShell eso deja
 * un temporal en el DIRECTORIO DEL REPOSITORIO —`mktemp` lo crea en
 * `$source_dir`, no en `$TMPDIR`— que después aparece en `git status` sin que
 * nadie sepa de dónde salió.
 */
describe('el instalador limpia incluso cuando el hijo falla', () => {
  it('la invocación de PowerShell no deja el cleanup inalcanzable', () => {
    const idx = SETUP.indexOf('-ExecutionPolicy Bypass -File "$tmp_windows"')
    assert.ok(idx > 0, 'la invocación de PowerShell cambió de forma')
    const line = SETUP.slice(idx, SETUP.indexOf('\n', idx))
    assert.match(
      line,
      /\|\|\s*rc=\$\?/,
      `si PowerShell falla, el cleanup queda inalcanzable: ${line.trim()}`,
    )
  })

  it('el cleanup sigue existiendo y va después de la invocación', () => {
    const invokeAt = SETUP.indexOf('-ExecutionPolicy Bypass -File "$tmp_windows"')
    const rmAt = SETUP.indexOf('rm -f "$tmp_posix"', invokeAt)
    assert.ok(rmAt > invokeAt, 'el temporal del sanitizer dejó de borrarse')
  })

  it('demuestra la causa: bajo set -e un comando suelto saltea el cleanup', () => {
    // Ejecutado y no argumentado: las dos formas corren acá y se ve la
    // diferencia. Un test que sólo mirara el texto del `||` pasaría igual si
    // `set -e` dejara de estar, y entonces el `||` no protegería nada.
    const run = (body) => {
      try {
        return execFileSync('bash', ['-c', body], { encoding: 'utf8' })
      } catch (e) {
        return e.stdout ?? ''
      }
    }

    // Llamado plano, como en setup.sh: el fallo aborta antes del echo.
    assert.doesNotMatch(
      run('set -euo pipefail; f() { false; echo LIMPIEZA; }; f; echo FIN'),
      /LIMPIEZA/,
    )
    // Con `|| rc=$?` la limpieza corre y el código de salida se conserva.
    assert.match(
      run('set -euo pipefail; f() { local rc=0; false || rc=$?; echo LIMPIEZA; return $rc; }; f; echo FIN'),
      /LIMPIEZA/,
    )
  })
})
