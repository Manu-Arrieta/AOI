import assert from "node:assert/strict";
import test from "node:test";

import {
  allowedDispositions,
  allowedKinds,
  allowedStatuses,
  allowedSurfaces,
  validateManifest,
} from "./manifest-schema.mjs";

function baseManifest() {
  return {
    $schemaVersion: 1,
    sandbox: "auth-v2",
    generatedAt: "2026-06-15T18:00:00.000Z",
    compartments: [
      {
        id: "auth-ui",
        kind: "frontend",
        surface: "visual-ui",
        scope: [".sandboxes/auth-v2/ui"],
        stack: ["vue", "nuxt-ui"],
        integrationTarget: "frontend:aoi_apps/agentic-ops-dashboard/app/components",
        chain: ["page/flow", "store/state", "service", "execution-client"],
        addedInConstitutionVersion: "1.0.0",
      },
      {
        id: "auth-api",
        kind: "backend",
        surface: "swagger",
        scope: [".sandboxes/auth-v2/api"],
        stack: ["nitro"],
        integrationTarget: "backend:aoi_apps/agentic-ops-dashboard/server",
        chain: ["route/controller", "service", "repository", "data-client"],
        addedInConstitutionVersion: "1.1.0",
      },
    ],
    elements: [
      {
        id: "auth-form",
        path: ".sandboxes/auth-v2/ui/AuthForm.vue",
        compartment: "auth-ui",
        kind: "component",
        disposition: "integrate",
        target:
          "frontend:aoi_apps/agentic-ops-dashboard/app/components/AuthForm.vue",
        status: "pending",
        notes: "Replace mock submit with real service boundary on migration",
      },
    ],
  };
}

function skeletonManifest() {
  return {
    $schemaVersion: 1,
    sandbox: "auth-v2",
    generatedAt: "2026-06-15T18:00:00.000Z",
    compartments: [],
    elements: [],
  };
}

test("enum sets match the locked schema", () => {
  assert.deepEqual(
    [...allowedKinds],
    ["frontend", "backend", "api-contract", "data", "infra", "docs"],
  );
  assert.deepEqual(
    [...allowedSurfaces],
    ["visual-ui", "swagger", "terminal", "storybook", "none"],
  );
  assert.deepEqual(
    [...allowedDispositions],
    ["integrate", "discard", "visualization-only", "undecided"],
  );
  assert.deepEqual(
    [...allowedStatuses],
    ["pending", "in-progress", "migrated", "discarded"],
  );
});

test("accepts a fully populated manifest", () => {
  assert.doesNotThrow(() =>
    validateManifest(baseManifest(), { filePath: "m.json" }),
  );
});

test("accepts a skeleton manifest with empty compartments and elements", () => {
  assert.doesNotThrow(() =>
    validateManifest(skeletonManifest(), { filePath: "m.json" }),
  );
});

test("rejects an unknown element disposition", () => {
  const manifest = baseManifest();
  manifest.elements[0].disposition = "maybe";
  assert.throws(() => validateManifest(manifest), /disposition must be one of/);
});

test("rejects an unknown element status", () => {
  const manifest = baseManifest();
  manifest.elements[0].status = "done";
  assert.throws(() => validateManifest(manifest), /status must be one of/);
});

test("rejects an unknown compartment kind", () => {
  const manifest = baseManifest();
  manifest.compartments[0].kind = "mobile";
  assert.throws(() => validateManifest(manifest), /kind must be one of/);
});

test("rejects an unknown compartment surface", () => {
  const manifest = baseManifest();
  manifest.compartments[0].surface = "hologram";
  assert.throws(() => validateManifest(manifest), /surface must be one of/);
});

test("rejects a missing required field", () => {
  const manifest = baseManifest();
  delete manifest.compartments[0].scope;
  assert.throws(() => validateManifest(manifest), /scope must be an array/);
});

test("rejects a duplicate element id", () => {
  const manifest = baseManifest();
  manifest.elements.push({ ...manifest.elements[0] });
  assert.throws(
    () => validateManifest(manifest),
    /id "auth-form" is duplicated/,
  );
});

test("rejects a duplicate compartment id", () => {
  const manifest = baseManifest();
  manifest.compartments[1].id = "auth-ui";
  assert.throws(() => validateManifest(manifest), /id "auth-ui" is duplicated/);
});

test("rejects a dangling compartment reference", () => {
  const manifest = baseManifest();
  manifest.elements[0].compartment = "ghost";
  assert.throws(
    () => validateManifest(manifest),
    /does not reference a declared compartment/,
  );
});

test("rejects a path that escapes the sandbox subtree", () => {
  const manifest = baseManifest();
  manifest.elements[0].path = ".sandboxes/auth-v2/../secrets.txt";
  assert.throws(() => validateManifest(manifest), /path traversal/);
});

test("rejects a path outside the sandbox subtree", () => {
  const manifest = baseManifest();
  manifest.elements[0].path = "aoi_apps/agentic-ops-dashboard/app/leak.vue";
  assert.throws(() => validateManifest(manifest), /must stay within/);
});

test("rejects a malformed target token", () => {
  const manifest = baseManifest();
  manifest.elements[0].target = "unknown:apps/x.vue";
  assert.throws(() => validateManifest(manifest), /unknown root key/);
});
