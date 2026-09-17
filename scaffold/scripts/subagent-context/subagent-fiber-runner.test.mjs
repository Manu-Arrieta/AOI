/**
 * scripts/subagent-context/subagent-fiber-runner.test.mjs
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  createSubagentSandbox,
  restoreTrackedFiles,
  TRACKED_WRITE_ROLLBACK_SCOPE,
} from './subagent-fiber-runner.mjs';

describe('Subagent Fiber Runner: Revertible Sandboxes', () => {
  const testTaskDir = path.resolve(process.cwd(), '.tasks/test-feature/TASK-2026-999');
  const tempTestFile = path.resolve(process.cwd(), '.tasks/test-feature/TASK-2026-999/test-output.txt');

  before(() => {
    fs.mkdirSync(testTaskDir, { recursive: true });
    fs.writeFileSync(path.join(testTaskDir, 'tasks.md'), '### Task T-1: Test backend [backend]\n- Build mock\n');
    fs.writeFileSync(path.join(testTaskDir, 'design.md'), 'export interface Test { id: string }\n');
  });

  after(() => {
    if (fs.existsSync(testTaskDir)) {
      fs.rmSync(path.resolve(process.cwd(), '.tasks/test-feature'), { recursive: true, force: true });
    }
  });

  it('BIC-2026-002:never.1 restores only writes explicitly registered with the sandbox', () => {
    const sandbox = createSubagentSandbox({
      role: 'backend',
      taskDir: '.tasks/test-feature/TASK-2026-999',
      format: 'toon'
    });

    assert.equal(sandbox.role, 'backend');
    assert.match(sandbox.payload, /::AOI_SUBAGENT_PAYLOAD\[v2\]::/);

    // Simulate subagent writing a file in the sandbox
    sandbox.trackFileWrite(tempTestFile, 'hello world');
    assert.equal(fs.existsSync(tempTestFile), true);
    assert.equal(sandbox.getTrackedFileCount(), 1);

    assert.equal(sandbox.rollbackScope, TRACKED_WRITE_ROLLBACK_SCOPE);

    // Local tracked-write recovery does not require LLM inference.
    sandbox.rollback();
    assert.equal(fs.existsSync(tempTestFile), false);
  });

  it('BIC-2026-002:oracle leaves an untracked direct write untouched by rollback', () => {
    const directWriteFile = path.join(testTaskDir, 'direct-write.txt');
    fs.writeFileSync(directWriteFile, 'before');

    const sandbox = createSubagentSandbox({
      role: 'backend',
      taskDir: '.tasks/test-feature/TASK-2026-999',
    });

    // This simulates an editor/tool write that did not call trackFileWrite.
    fs.writeFileSync(directWriteFile, 'outside-trackFileWrite');
    sandbox.rollback();

    assert.equal(fs.readFileSync(directWriteFile, 'utf8'), 'outside-trackFileWrite');
  });

  it('BIC-2026-002:never.3 scopes recovery guidance without a universal timing promise', (t) => {
    // Este caso auditea la DOCUMENTACIÓN DE AOI: que sus contratos públicos no
    // publiquen una garantía temporal que nadie midió. En un workspace instalado
    // `docs/` es del Owner y el veredicto no es sobre AOI, así que el caso leía
    // `docs/README.md` y moría con ENOENT — haciendo salir `pnpm test` con 1 en
    // una instalación de perfil core, que es el perfil por defecto.
    //
    // El discriminador es `setup.sh`, el mismo que ya usan `validate-srp`,
    // `validate-test-globs`, `claude-project-guide`, `check-hook-wiring` e
    // `install-git-guard`. El `return` es obligatorio: `t.skip()` marca el caso
    // pero NO detiene la ejecución.
    if (!fs.existsSync(path.resolve(process.cwd(), 'setup.sh'))) {
      t.skip('workspace instalado: el veredicto no es sobre la documentación de AOI');
      return;
    }

    const prompts = [
      '.github/prompts/sdd-apply.prompt.md',
      '.github/prompts/sdd-verify.prompt.md',
      'scaffold/.github/prompts/sdd-apply.prompt.md',
      'scaffold/.github/prompts/sdd-verify.prompt.md',
    ];

    for (const prompt of prompts) {
      const content = fs.readFileSync(path.resolve(process.cwd(), prompt), 'utf8');
      assert.match(content, /trackFileWrite/, `${prompt} omite el límite de registro explícito`);
      assert.doesNotMatch(content, /all mutations carry explicit inverses/i, `${prompt} promete inversas universales`);
      assert.doesNotMatch(content, /restoring the workspace state in 0ms/i, `${prompt} promete un SLA no medido`);
    }

    const publicContracts = [
      'README.md',
      'scaffold/README.md',
      'docs/README.md',
      'docs/internal/architecture/BEHAVIORAL_INTENT_CONTRACTS_PARADIGM.md',
      'docs/internal/architecture/SPATIOTEMPORAL_MATHEMATICAL_FOUNDATIONS.md',
      'docs/internal/architecture/SPATIOTEMPORAL_MATHEMATICAL_FOUNDATIONS.es.md',
    ];

    for (const document of publicContracts) {
      const content = fs.readFileSync(path.resolve(process.cwd(), document), 'utf8');
      assert.match(content, /registrad|registered/i, `${document} omite el alcance de efectos registrados`);
      assert.doesNotMatch(content, /0 ms (and|y) 0 tokens|< 2 milliseconds|< 2 milisegundos/i, `${document} publica una garantía temporal no medida`);
    }
  });
});

describe('restoreTrackedFiles: la operación que el Invariante 3 promete', () => {
  // Vivía duplicada byte a byte en dos lugares y sólo una tenía test: el
  // rollback() manual. La copia sin cubrir era el teardown del Fiber, o sea
  // justo la ruta que le da nombre al invariante, y una mutación que invertía
  // su comparación la convertía en destructora de archivos preexistentes sin
  // que nada fallara. Ahora es una sola función y se prueba de frente, no a
  // través de uno de sus dos llamadores.
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-rb-'));

  /** Un snapshot con la misma forma que produce `trackFileWrite`. */
  const entry = (content, mode = 0o644, dirs = []) => ({ content, mode, dirs });

  it('restaura un archivo preexistente en vez de borrarlo', () => {
    const dir = tmp();
    const victim = path.join(dir, 'del-owner.ts');
    fs.writeFileSync(victim, 'CONTENIDO ORIGINAL');

    const tracked = new Map([[victim, entry(Buffer.from('CONTENIDO ORIGINAL'))]]);
    fs.writeFileSync(victim, 'lo que escribió el subagente');
    restoreTrackedFiles(tracked);

    assert.equal(fs.existsSync(victim), true, 'el rollback borró un archivo que ya existía');
    assert.equal(fs.readFileSync(victim, 'utf8'), 'CONTENIDO ORIGINAL');
    assert.equal(tracked.size, 0, 'el registro quedó sin vaciar');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('borra el archivo que no existía antes', () => {
    const dir = tmp();
    const created = path.join(dir, 'nuevo.ts');
    fs.writeFileSync(created, 'lo creó el subagente');

    restoreTrackedFiles(new Map([[created, entry(null)]]));

    assert.equal(fs.existsSync(created), false, 'sobrevivió un archivo que el subagente creó');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('tolera que el archivo a borrar ya no esté', () => {
    const dir = tmp();
    restoreTrackedFiles(new Map([[path.join(dir, 'fantasma.ts'), entry(null)]]));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('restaura BYTES, no texto: un binario vuelve idéntico', () => {
    // La versión anterior leía y escribía con `'utf8'`, así que cada byte
    // inválido se volvía U+FFFD de forma irreversible. El módulo prometía
    // recuperación exacta y no podía cumplirla para ningún archivo binario.
    const dir = tmp();
    const bin = path.join(dir, 'blob.bin');
    const original = Buffer.from([0xff, 0x00, 0xfe, 0x80, 0x41, 0x00, 0x42, 0xff]);
    fs.writeFileSync(bin, original);

    const tracked = new Map([[bin, entry(fs.readFileSync(bin), 0o644, [])]]);
    fs.writeFileSync(bin, Buffer.from([0x41, 0x41]));
    restoreTrackedFiles(tracked);

    assert.deepEqual(fs.readFileSync(bin), original, 'el roundtrip por texto corrompió los bytes');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('devuelve los permisos que el subagente cambió', () => {
    // Premisa medida, porque la primera versión de este test la daba por
    // sentada y era FALSA: `writeFileSync` NO cambia el modo de un archivo que
    // ya existe (755 sigue 755). Lo que sí lo cambia es que el subagente
    // rehaga el archivo o llame a `chmod` — y ahí el rollback anterior escribía
    // el contenido y dejaba los permisos nuevos, que es la mitad de restaurar.
    const dir = tmp();
    const script = path.join(dir, 'x.sh');
    fs.writeFileSync(script, '#!/bin/sh\n');
    fs.chmodSync(script, 0o755);

    const tracked = new Map([[script, entry(fs.readFileSync(script), 0o755, [])]]);
    fs.chmodSync(script, 0o644);
    assert.equal(fs.statSync(script).mode & 0o7777, 0o644, 'premisa: el subagente cambió el modo');

    restoreTrackedFiles(tracked);

    assert.equal(fs.statSync(script).mode & 0o7777, 0o755, 'el rollback no devolvió el modo');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('borra los directorios que creó y deja los que ya existían', () => {
    const dir = tmp();
    const preexisting = path.join(dir, 'ya-estaba');
    fs.mkdirSync(preexisting, { recursive: true });
    const keeper = path.join(preexisting, 'guardado.txt');
    fs.writeFileSync(keeper, 'sobrevive');

    const deep = path.join(dir, 'nuevo', 'muy', 'adentro');
    const created = path.join(deep, 'a.txt');
    const dirs = [path.join(dir, 'nuevo'), path.join(dir, 'nuevo', 'muy'), deep];
    const tracked = new Map([[created, entry(null, 0o644, dirs)]]);
    fs.mkdirSync(deep, { recursive: true });
    fs.writeFileSync(created, 'lo creó el subagente');

    restoreTrackedFiles(tracked);

    assert.equal(fs.existsSync(created), false);
    assert.equal(fs.existsSync(path.join(dir, 'nuevo')), false, 'quedó un rastro de directorios vacíos');
    assert.equal(fs.existsSync(keeper), true, 'el rollback se llevó un directorio que ya existía');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('el teardown del Fiber y rollback() comparten implementación', () => {
    // La aserción que no existía. Comparten función, y esto es lo que impide
    // que vuelvan a separarse sin que nadie se entere.
    // Sólo código: un comentario que nombre la expresión no debe romper la
    // compuerta, y este archivo tiene uno que explica por qué existe.
    const source = fs
      .readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'subagent-fiber-runner.mjs'), 'utf8')
      .split('\n')
      .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
      .join('\n');
    // Sin la definición: `export function restoreTrackedFiles(trackedFiles)`
    // matchea la misma forma que una llamada.
    const callers = source.match(/(?<!function )restoreTrackedFiles\(trackedFiles\)/g) ?? [];
    assert.equal(callers.length, 2, 'una de las dos rutas de rollback dejó de usar la función común');
    assert.equal(
      (source.match(/entry\.content === null/g) ?? []).length,
      1,
      'la comparación de rollback volvió a duplicarse'
    );
  });
});
