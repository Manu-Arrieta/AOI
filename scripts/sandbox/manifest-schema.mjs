// Assertion-based schema for `.sandboxes/{name}/integration-manifest.json`.
// Pure, dependency-light (Node built-ins only), following the
// `scripts/memory-sync/schema.mjs` precedent: throw-on-first assertion with a
// descriptive, path-prefixed message.

import { posix } from "node:path";

export const allowedKinds = new Set([
  "frontend",
  "backend",
  "api-contract",
  "data",
  "infra",
  "docs",
]);
export const allowedSurfaces = new Set([
  "visual-ui",
  "swagger",
  "terminal",
  "storybook",
  "none",
]);
export const allowedDispositions = new Set([
  "integrate",
  "discard",
  "visualization-only",
  "undecided",
]);
export const allowedStatuses = new Set([
  "pending",
  "in-progress",
  "migrated",
  "discarded",
]);
export const allowedRootKeys = new Set(["frontend", "backend", "sharedLibs"]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(value, fieldName) {
  assert(
    typeof value === "string" && value.trim().length > 0,
    `${fieldName} must be a non-empty string.`,
  );
}

function assertIsoDateString(value, fieldName) {
  assertString(value, fieldName);
  assert(
    !Number.isNaN(Date.parse(value)),
    `${fieldName} must be a valid ISO date string.`,
  );
}

function assertStringArray(values, fieldName, options = {}) {
  const { allowEmpty = true } = options;

  assert(Array.isArray(values), `${fieldName} must be an array.`);
  if (!allowEmpty) {
    assert(values.length > 0, `${fieldName} must be a non-empty array.`);
  }

  for (const value of values) {
    assertString(value, `${fieldName}[]`);
  }
}

function assertEnum(value, allowed, fieldName) {
  assertString(value, fieldName);
  assert(
    allowed.has(value),
    `${fieldName} must be one of ${[...allowed].join(", ")} (received "${value}").`,
  );
}

function assertTargetToken(value, fieldName, options = {}) {
  const { allowNull = false } = options;

  if (value === null) {
    assert(allowNull, `${fieldName} must not be null.`);
    return;
  }

  assertString(value, fieldName);
  if (value === "visualization-only") {
    return;
  }

  const separatorIndex = value.indexOf(":");
  assert(
    separatorIndex > 0,
    `${fieldName} must be "visualization-only" or "{rootKey}:{path}" (received "${value}").`,
  );

  const rootKey = value.slice(0, separatorIndex);
  const rest = value.slice(separatorIndex + 1);
  assert(
    allowedRootKeys.has(rootKey),
    `${fieldName} has unknown root key "${rootKey}" (expected one of ${[...allowedRootKeys].join(", ")}).`,
  );
  assert(
    rest.trim().length > 0,
    `${fieldName} must include a path after "${rootKey}:".`,
  );
}

function assertSandboxPath(value, fieldName, sandbox) {
  assertString(value, fieldName);

  // El nombre del sandbox compone el prefijo, así que tiene que ser un segmento
  // solo: con `foo/bar` el prefijo pasa a ser `.sandboxes/foo/bar/` y el guard
  // valida contra un sandbox que no existe; con `..` el prefijo mismo sale del
  // árbol. Antes no se validaba y los dos casos pasaban.
  assert(
    sandbox !== "" && !sandbox.includes("/") && !sandbox.includes("\\") && sandbox !== ".." && sandbox !== ".",
    `sandbox name must be a single path segment (received "${sandbox}").`,
  );

  const sandboxRoot = `.sandboxes/${sandbox}`;
  const expectedPrefix = `${sandboxRoot}/`;

  // Separador de Windows. `split("/")` NO ve una barra invertida, así que
  // `.sandboxes/x/..\..\..\Windows` se colaba entero: para el chequeo de `..`
  // era un único elemento de nombre raro. Medido: pasaba y el CLI salía 0, o sea
  // un falso verde en una compuerta que `/sdd-verify` declara como FAIL.
  // `resource-operations.ts` ya normaliza `\` -> `/` antes de testear contención;
  // acá faltaba.
  const normalized = value.replaceAll("\\", "/");

  assert(
    normalized.startsWith(expectedPrefix),
    `${fieldName} must stay within "${expectedPrefix}" (received "${value}").`,
  );

  // Contención sobre el path NORMALIZADO y no sobre el string crudo, y las dos
  // direcciones importan:
  //
  //   `.sandboxes/x/../../../etc`  -> `../../../etc`          -> RECHAZADO
  //   `.sandboxes/x/a/../b`        -> `.sandboxes/x/b`        -> ACEPTADO
  //
  // La versión anterior exigía que no hubiera NINGÚN `..` en el path, así que
  // rechazaba el segundo —un path válido y dentro del sandbox— y a la vez dejaba
  // pasar el primero escrito con barras invertidas, que sale del árbol. Resolver
  // primero arregla los dos: es la misma prueba que hace el dashboard.
  const resolved = posix.normalize(normalized);
  assert(
    resolved === sandboxRoot || resolved.startsWith(expectedPrefix),
    `${fieldName} resolves outside "${expectedPrefix}" (received "${value}").`,
  );
}

function validateCompartment(raw, options) {
  const { prefix, compartmentIds } = options;

  assert(isPlainObject(raw), `${prefix}compartment must be an object.`);
  assertString(raw.id, `${prefix}id`);
  assert(!compartmentIds.has(raw.id), `${prefix}id "${raw.id}" is duplicated.`);
  compartmentIds.add(raw.id);

  assertEnum(raw.kind, allowedKinds, `${prefix}kind`);
  assertEnum(raw.surface, allowedSurfaces, `${prefix}surface`);
  assertStringArray(raw.scope, `${prefix}scope`);
  assertStringArray(raw.stack, `${prefix}stack`);
  assertTargetToken(raw.integrationTarget, `${prefix}integrationTarget`, {
    allowNull: false,
  });
  assertString(
    raw.addedInConstitutionVersion,
    `${prefix}addedInConstitutionVersion`,
  );
  assert(
    /^\d+\.\d+\.\d+$/.test(raw.addedInConstitutionVersion),
    `${prefix}addedInConstitutionVersion must be a semver "X.Y.Z" string.`,
  );

  if (raw.kind === "backend") {
    assertStringArray(raw.chain, `${prefix}chain`, { allowEmpty: false });
  } else if (raw.chain !== undefined) {
    assertStringArray(raw.chain, `${prefix}chain`);
  }
}

function validateElement(raw, options) {
  const { prefix, sandbox, compartmentIds, elementIds } = options;

  assert(isPlainObject(raw), `${prefix}element must be an object.`);
  assertString(raw.id, `${prefix}id`);
  assert(!elementIds.has(raw.id), `${prefix}id "${raw.id}" is duplicated.`);
  elementIds.add(raw.id);

  assertSandboxPath(raw.path, `${prefix}path`, sandbox);
  assertString(raw.compartment, `${prefix}compartment`);
  assert(
    compartmentIds.has(raw.compartment),
    `${prefix}compartment "${raw.compartment}" does not reference a declared compartment.`,
  );
  assertString(raw.kind, `${prefix}kind`);
  assertEnum(raw.disposition, allowedDispositions, `${prefix}disposition`);
  assertEnum(raw.status, allowedStatuses, `${prefix}status`);
  assertTargetToken(raw.target, `${prefix}target`, { allowNull: true });
  assert(
    typeof raw.notes === "string",
    `${prefix}notes must be a string (may be empty).`,
  );
}

export function validateManifest(raw, options = {}) {
  const prefix = options.filePath ? `${options.filePath}: ` : "";

  assert(isPlainObject(raw), `${prefix}manifest must be an object.`);
  assert(raw.$schemaVersion === 1, `${prefix}$schemaVersion must be 1.`);
  assertString(raw.sandbox, `${prefix}sandbox`);
  assertIsoDateString(raw.generatedAt, `${prefix}generatedAt`);
  assert(
    Array.isArray(raw.compartments),
    `${prefix}compartments must be an array.`,
  );
  assert(Array.isArray(raw.elements), `${prefix}elements must be an array.`);

  const compartmentIds = new Set();
  for (const [index, compartment] of raw.compartments.entries()) {
    validateCompartment(compartment, {
      prefix: `${prefix}compartments[${index}].`,
      compartmentIds,
    });
  }

  const elementIds = new Set();
  for (const [index, element] of raw.elements.entries()) {
    validateElement(element, {
      prefix: `${prefix}elements[${index}].`,
      sandbox: raw.sandbox,
      compartmentIds,
      elementIds,
    });
  }

  return raw;
}
