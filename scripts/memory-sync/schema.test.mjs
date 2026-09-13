import { describe, it } from "node:test";
import assert from "node:assert";

import {
  loadJsonFile,
  validateActiveVersionIndex,
  validateBundleMetadata,
  validateMemoryBundle,
} from "./schema.mjs";

// ── validateBundleMetadata ──────────────────────────────────────────────────

describe("validateBundleMetadata", () => {
  it("accepts a valid metadata object", () => {
    const metadata = {
      sourceWorkspace: "my-project",
      sourceVersionId: "v1.0.0",
      exportedAt: "2026-07-31T00:00:00.000Z",
      formatVersion: "1",
      includedScopes: ["memories", "memoir"],
      omittedScopes: ["feedback"],
      integrity: {
        algorithm: "sha256",
        digest:
          "0000000000000000000000000000000000000000000000000000000000000001",
      },
    };
    const result = validateBundleMetadata(metadata);
    assert.strictEqual(result, metadata);
  });

  it("throws when sourceWorkspace is missing", () => {
    assert.throws(
      () =>
        validateBundleMetadata({
          sourceVersionId: "v1",
          exportedAt: "2026-07-31T00:00:00.000Z",
          formatVersion: "1",
          includedScopes: ["memories"],
          integrity: { algorithm: "sha256", digest: "0".repeat(64) },
        }),
      /sourceWorkspace/,
    );
  });

  it("throws when includedScopes is empty", () => {
    assert.throws(
      () =>
        validateBundleMetadata({
          sourceWorkspace: "x",
          sourceVersionId: "v1",
          exportedAt: "2026-07-31T00:00:00.000Z",
          formatVersion: "1",
          includedScopes: [],
          integrity: { algorithm: "sha256", digest: "0".repeat(64) },
        }),
      /non-empty/,
    );
  });

  it("throws for unsupported scope in includedScopes", () => {
    assert.throws(
      () =>
        validateBundleMetadata({
          sourceWorkspace: "x",
          sourceVersionId: "v1",
          exportedAt: "2026-07-31T00:00:00.000Z",
          formatVersion: "1",
          includedScopes: ["invalid-scope"],
          integrity: { algorithm: "sha256", digest: "0".repeat(64) },
        }),
      /unsupported scope/,
    );
  });

  it("throws when a scope appears in both included and omitted", () => {
    assert.throws(
      () =>
        validateBundleMetadata({
          sourceWorkspace: "x",
          sourceVersionId: "v1",
          exportedAt: "2026-07-31T00:00:00.000Z",
          formatVersion: "1",
          includedScopes: ["memories"],
          omittedScopes: ["memories"],
          integrity: { algorithm: "sha256", digest: "0".repeat(64) },
        }),
      /already present/,
    );
  });

  it("throws for invalid integrity algorithm", () => {
    assert.throws(
      () =>
        validateBundleMetadata({
          sourceWorkspace: "x",
          sourceVersionId: "v1",
          exportedAt: "2026-07-31T00:00:00.000Z",
          formatVersion: "1",
          includedScopes: ["memories"],
          integrity: { algorithm: "md5", digest: "0".repeat(64) },
        }),
      /algorithm must be one of/,
    );
  });

  it("throws for non-hex digest", () => {
    assert.throws(
      () =>
        validateBundleMetadata({
          sourceWorkspace: "x",
          sourceVersionId: "v1",
          exportedAt: "2026-07-31T00:00:00.000Z",
          formatVersion: "1",
          includedScopes: ["memories"],
          integrity: { algorithm: "sha256", digest: "ZZZ" },
        }),
      /hex string/,
    );
  });

  it("throws for invalid date string", () => {
    assert.throws(
      () =>
        validateBundleMetadata({
          sourceWorkspace: "x",
          sourceVersionId: "v1",
          exportedAt: "not-a-date",
          formatVersion: "1",
          includedScopes: ["memories"],
          integrity: { algorithm: "sha256", digest: "0".repeat(64) },
        }),
      /ISO date/,
    );
  });
});

// ── validateMemoryBundle ────────────────────────────────────────────────────

describe("validateMemoryBundle", () => {
  const validBundle = {
    metadata: {
      sourceWorkspace: "my-project",
      sourceVersionId: "v1.0.0",
      exportedAt: "2026-07-31T00:00:00.000Z",
      formatVersion: "1",
      includedScopes: ["memories"],
      omittedScopes: [],
      integrity: {
        algorithm: "sha256",
        digest:
          "0000000000000000000000000000000000000000000000000000000000000001",
      },
    },
    payload: {
      memories: {},
    },
  };

  it("accepts a valid bundle", () => {
    const result = validateMemoryBundle(validBundle);
    assert.strictEqual(result, validBundle);
  });

  it("throws when payload is missing an included scope", () => {
    const bundle = {
      metadata: {
        ...validBundle.metadata,
        includedScopes: ["memories", "memoir"],
        omittedScopes: [],
      },
      payload: { memoir: {} },
    };
    assert.throws(() => validateMemoryBundle(bundle), /missing included scope/);
  });

  it("throws when payload has an unsupported scope", () => {
    const bundle = structuredClone(validBundle);
    bundle.payload.invalid = {};
    assert.throws(() => validateMemoryBundle(bundle), /unsupported scope/);
  });

  it("throws when metadata is not an object", () => {
    assert.throws(
      () => validateMemoryBundle({ metadata: "not-an-object", payload: {} }),
      /object/,
    );
  });

  it("throws when payload is not an object", () => {
    assert.throws(
      () =>
        validateMemoryBundle({
          metadata: validBundle.metadata,
          payload: "bad",
        }),
      /object/,
    );
  });

  it("throws when payload is empty", () => {
    assert.throws(
      () =>
        validateMemoryBundle({ metadata: validBundle.metadata, payload: {} }),
      /at least one/,
    );
  });
});

// ── loadJsonFile ─────────────────────────────────────────────────────────────

describe("loadJsonFile", () => {
  it("throws when the file does not exist", () => {
    assert.rejects(
      () => loadJsonFile("/tmp/nonexistent-aoi-schema-test-2026-07-31.json"),
      /ENOENT/,
    );
  });
});

describe("rollbackReason, el rastro de auditoría del rollback", () => {
  const index = (state) => ({
    formatVersion: 1,
    workspaceStates: {
      ws: {
        activeVersionId: "v2",
        previousVersionId: "v3",
        updatedAt: "2026-09-12T00:00:00.000Z",
        ...state,
      },
    },
  });

  it("acepta el índice sin el campo, que es optativo", () => {
    assert.doesNotThrow(() => validateActiveVersionIndex(index({})));
  });

  it("acepta el motivo cuando está y es texto", () => {
    assert.doesNotThrow(() => validateActiveVersionIndex(index({ rollbackReason: "rompió el piso" })));
  });

  it("rechaza un motivo que no es texto", () => {
    // El campo se persiste, así que tiene que poder decir cuándo está mal:
    // un dato que nadie mira se puede escribir mal para siempre.
    for (const bad of [42, {}, [], true]) {
      assert.throws(
        () => validateActiveVersionIndex(index({ rollbackReason: bad })),
        /rollbackReason/,
        `aceptó ${JSON.stringify(bad)} como motivo`,
      );
    }
  });
});
