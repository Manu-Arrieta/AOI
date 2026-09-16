/**
 * scripts/sandbox/write-base-project.test.mjs
 *
 * El escritor existe por una sola regla, y por eso empieza acá: un mapa
 * persistido dice QUIÉN lo confirmó. `confirmedBy: null` es la marca de una
 * propuesta, y una propuesta en disco miente sobre su propio estado.
 *
 * El caso que la motivó no fue hipotético. Un workspace quedó con el hecho de
 * ICM, el concepto de memoir y dos consumidores —`sdd-verify.prompt.md` e
 * `@integration-specialist`— resolviendo rutas contra un
 * `.specify/memory/base-project.json` que no existía: el detector sólo lo había
 * IMPRESO, `/init` era prosa, y nada distinguía una cosa de la otra.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  BASE_PROJECT_RELATIVE_PATH,
  buildConfirmedMap,
  normalizeOwner,
  parseArgs,
  writeBaseProject,
} from "./write-base-project.mjs";

const PROPOSAL = {
  $schemaVersion: 1,
  baseRoot: ".",
  detectedAt: "2026-09-15T00:00:00.000Z",
  confirmedBy: null,
  workspaceManager: "pnpm",
  roots: { frontend: ["apps/web"], backend: ["apps/api"], sharedLibs: [] },
};

function withTempDir(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aoi-base-project-"));
  try {
    return run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("un mapa persistido no puede quedar sin Owner", () => {
  // Las cuatro formas de decir "no lo confirmó nadie" sin decirlo.
  for (const value of [undefined, null, "", "   ", "null", "NULL", "undefined", "none"]) {
    assert.throws(
      () => normalizeOwner(value),
      /--confirmed-by is required/,
      `aceptó ${JSON.stringify(value)} como Owner`,
    );
  }
});

test("el Owner confirmado sobrevive al mapa", () => {
  const map = buildConfirmedMap({ proposal: PROPOSAL, confirmedBy: "  Manu Arrieta  " });

  assert.equal(map.confirmedBy, "Manu Arrieta", "no recortó el nombre del Owner");
  assert.notEqual(map.confirmedBy, null);
});

test("las tres claves de roots existen siempre, aunque la propuesta las omita", () => {
  // Un consumidor que hace `roots.sharedLibs.map(...)` no puede depender de que
  // el detector haya tenido algo que decir sobre sharedLibs.
  const map = buildConfirmedMap({ proposal: { roots: { frontend: ["apps/web"] } }, confirmedBy: "Ana" });

  assert.deepEqual(Object.keys(map.roots).sort(), ["backend", "frontend", "sharedLibs"]);
  assert.deepEqual(map.roots.sharedLibs, []);
});

test("una propuesta no se confirma a sí misma", () => {
  // El detector devuelve `confirmedBy: null` a propósito. Si el escritor lo
  // copiara, el archivo afirmaría estar confirmado y sin confirmar a la vez.
  const map = buildConfirmedMap({ proposal: PROPOSAL, confirmedBy: "Ana" });

  assert.equal(PROPOSAL.confirmedBy, null);
  assert.equal(map.confirmedBy, "Ana");
});

test("roots que no son listas se rechazan en vez de aplanarse", () => {
  assert.throws(
    () => buildConfirmedMap({ proposal: { roots: { frontend: "apps/web" } }, confirmedBy: "Ana" }),
    /roots\.frontend must be an array/,
  );
});

test("escribe el archivo en la ruta que los consumidores buscan", () => {
  withTempDir((dir) => {
    const { filePath, written, existed } = writeBaseProject({
      cwd: dir,
      confirmedBy: "Ana",
      proposal: PROPOSAL,
    });

    assert.equal(written, true);
    assert.equal(existed, false);
    assert.equal(filePath, path.join(dir, ".specify", "memory", "base-project.json"));

    const onDisk = JSON.parse(fs.readFileSync(filePath, "utf8"));
    assert.equal(onDisk.confirmedBy, "Ana");
    assert.deepEqual(onDisk.roots.frontend, ["apps/web"]);
  });
});

test("no deja archivos temporales atrás", () => {
  withTempDir((dir) => {
    writeBaseProject({ cwd: dir, confirmedBy: "Ana", proposal: PROPOSAL });

    const memoryDir = path.join(dir, ".specify", "memory");
    const leftovers = fs.readdirSync(memoryDir).filter((f) => f.includes(".tmp"));

    assert.deepEqual(leftovers, [], "quedó un temporal de la escritura atómica");
  });
});

test("--dry-run no toca el disco", () => {
  withTempDir((dir) => {
    const { written } = writeBaseProject({
      cwd: dir,
      confirmedBy: "Ana",
      proposal: PROPOSAL,
      dryRun: true,
    });

    assert.equal(written, false);
    assert.equal(fs.existsSync(path.join(dir, BASE_PROJECT_RELATIVE_PATH)), false);
  });
});

test("reconfirmar reporta que el archivo ya existía", () => {
  withTempDir((dir) => {
    writeBaseProject({ cwd: dir, confirmedBy: "Ana", proposal: PROPOSAL });
    const second = writeBaseProject({ cwd: dir, confirmedBy: "Beto", proposal: PROPOSAL });

    assert.equal(second.existed, true);
    const onDisk = JSON.parse(fs.readFileSync(second.filePath, "utf8"));
    assert.equal(onDisk.confirmedBy, "Beto", "la reconfirmación no actualizó al Owner");
  });
});

test("el CLI no se conforma con un flag mal escrito", () => {
  // `--confirmed_by` con guión bajo caería en la rama de "falta el Owner" y se
  // leería como "nadie confirmó", que es un diagnóstico equivocado.
  assert.throws(() => parseArgs(["--confirmed_by", "Ana"]), /Unknown argument/);
  assert.throws(() => parseArgs(["--confirmed-by"]), /requires a value/);
  assert.throws(() => parseArgs(["--confirmed-by", "--json"]), /requires a value/);
});

test("el CLI reconoce lo que sí usa", () => {
  const options = parseArgs(["--confirmed-by", "Ana", "--cwd", "/tmp/x", "--dry-run", "--json"]);

  assert.deepEqual(options, {
    confirmedBy: "Ana",
    cwd: "/tmp/x",
    dryRun: true,
    json: true,
    help: false,
  });
});
