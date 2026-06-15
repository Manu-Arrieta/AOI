import assert from "node:assert/strict";
import test from "node:test";

import {
  GENERATED_BANNER,
  renderManifestMarkdown,
} from "./generate-manifest-md.mjs";

function skeletonManifest() {
  return {
    $schemaVersion: 1,
    sandbox: "skel",
    generatedAt: "2026-06-15T18:00:00.000Z",
    compartments: [],
    elements: [],
  };
}

function populatedManifest() {
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
        integrationTarget: "frontend:apps/agentic-ops-dashboard/app/components",
        chain: ["page/flow", "store/state", "service", "execution-client"],
        addedInConstitutionVersion: "1.0.0",
      },
      {
        id: "auth-api",
        kind: "backend",
        surface: "swagger",
        scope: [".sandboxes/auth-v2/api"],
        stack: ["nitro"],
        integrationTarget: "backend:apps/agentic-ops-dashboard/server",
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
          "frontend:apps/agentic-ops-dashboard/app/components/AuthForm.vue",
        status: "pending",
        notes: "",
      },
      {
        id: "auth-spinner",
        path: ".sandboxes/auth-v2/ui/AuthSpinner.vue",
        compartment: "auth-ui",
        kind: "component",
        disposition: "visualization-only",
        target: "visualization-only",
        status: "in-progress",
        notes: "",
      },
      {
        id: "login-endpoint",
        path: ".sandboxes/auth-v2/api/login.post.ts",
        compartment: "auth-api",
        kind: "endpoint",
        disposition: "integrate",
        target: "backend:apps/agentic-ops-dashboard/server/api/login.post.ts",
        status: "migrated",
        notes: "",
      },
      {
        id: "debug-probe",
        path: ".sandboxes/auth-v2/api/probe.ts",
        compartment: "auth-api",
        kind: "endpoint",
        disposition: "discard",
        target: null,
        status: "discarded",
        notes: "",
      },
      {
        id: "undecided-thing",
        path: ".sandboxes/auth-v2/api/thing.schema.ts",
        compartment: "auth-api",
        kind: "schema",
        disposition: "undecided",
        target: null,
        status: "pending",
        notes: "",
      },
    ],
  };
}

const EXPECTED_SKELETON = `<!-- generated:do-not-edit — source: integration-manifest.json -->
# Integration Manifest — skel
_Generated 2026-06-15T18:00:00.000Z — DO NOT EDIT (regenerated from JSON)._

## Compartments
| id | kind | surface | integration-target |
| -- | ---- | ------- | ------------------ |
`;

const EXPECTED_POPULATED = `<!-- generated:do-not-edit — source: integration-manifest.json -->
# Integration Manifest — auth-v2
_Generated 2026-06-15T18:00:00.000Z — DO NOT EDIT (regenerated from JSON)._

## Compartments
| id | kind | surface | integration-target |
| -- | ---- | ------- | ------------------ |
| auth-ui | frontend | visual-ui | frontend:apps/agentic-ops-dashboard/app/components |
| auth-api | backend | swagger | backend:apps/agentic-ops-dashboard/server |

## Elements — auth-ui
| id | kind | disposition | status | target |
| -- | ---- | ----------- | ------ | ------ |
| auth-form | component | integrate | pending | frontend:apps/agentic-ops-dashboard/app/components/AuthForm.vue |
| auth-spinner | component | visualization-only | in-progress | visualization-only |

## Elements — auth-api
| id | kind | disposition | status | target |
| -- | ---- | ----------- | ------ | ------ |
| login-endpoint | endpoint | integrate | migrated | backend:apps/agentic-ops-dashboard/server/api/login.post.ts |
| debug-probe | endpoint | discard | discarded | — |
| undecided-thing | schema | undecided | pending | — |
`;

test("skeleton manifest renders the banner + empty compartments table only", () => {
  assert.equal(renderManifestMarkdown(skeletonManifest()), EXPECTED_SKELETON);
});

test("populated manifest renders compartments + grouped elements (spec §4.3)", () => {
  assert.equal(renderManifestMarkdown(populatedManifest()), EXPECTED_POPULATED);
});

test("output always opens with the do-not-edit banner", () => {
  assert.ok(
    renderManifestMarkdown(skeletonManifest()).startsWith(
      `${GENERATED_BANNER}\n`,
    ),
  );
  assert.ok(
    renderManifestMarkdown(populatedManifest()).startsWith(
      `${GENERATED_BANNER}\n`,
    ),
  );
});

test("rendering is deterministic across repeated calls", () => {
  assert.equal(
    renderManifestMarkdown(populatedManifest()),
    renderManifestMarkdown(populatedManifest()),
  );
  assert.equal(
    renderManifestMarkdown(skeletonManifest()),
    renderManifestMarkdown(skeletonManifest()),
  );
});

test("null element targets render as an em dash placeholder", () => {
  const markdown = renderManifestMarkdown(populatedManifest());
  assert.match(
    markdown,
    /\| debug-probe \| endpoint \| discard \| discarded \| — \|/,
  );
});
