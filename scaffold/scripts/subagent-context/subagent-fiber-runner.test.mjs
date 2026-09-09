/**
 * scripts/subagent-context/subagent-fiber-runner.test.mjs
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createSubagentSandbox, restoreTrackedFiles } from './subagent-fiber-runner.mjs';

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

  it('instantiates subagent with TOON payload and tracks file writes with instant rollback', () => {
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

    // Rollback sandbox (0ms / 0 tokens LLM)
    sandbox.rollback();
    assert.equal(fs.existsSync(tempTestFile), false);
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

  it('restaura un archivo preexistente en vez de borrarlo', () => {
    const dir = tmp();
    const victim = path.join(dir, 'del-owner.ts');
    fs.writeFileSync(victim, 'CONTENIDO ORIGINAL');

    const tracked = new Map([[victim, 'CONTENIDO ORIGINAL']]);
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

    restoreTrackedFiles(new Map([[created, null]]));

    assert.equal(fs.existsSync(created), false, 'sobrevivió un archivo que el subagente creó');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('tolera que el archivo a borrar ya no esté', () => {
    const dir = tmp();
    restoreTrackedFiles(new Map([[path.join(dir, 'fantasma.ts'), null]]));
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
      (source.match(/origContent === null/g) ?? []).length,
      1,
      'la comparación de rollback volvió a duplicarse'
    );
  });
});
