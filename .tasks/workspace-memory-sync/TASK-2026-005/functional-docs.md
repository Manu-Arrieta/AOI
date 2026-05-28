# Compressed Workspace Memory Bundles

## Overview

This update adds a governed offline transport path for workspace memory. Instead
of requiring a live source workspace every time, the Owner can now export an
explicit memory version as a compressed bundle and later import that bundle into
another workspace as a candidate version.

The bundle flow does not bypass the existing governance model. Import still
creates a candidate first, preserves provenance, records the Owner's
`retain`/`complement`/`discard` decisions, and only becomes active after
explicit approval.

## What Was Implemented

- A governed export base directory at `.exportsmemories/` for portable memory
  bundle artifacts.
- A compressed bundle format `*.memory-bundle.json.gz` with source workspace,
  source version, included scopes, omitted scopes, export timestamp, format
  version, and `sha256` integrity metadata.
- A governed `/export-memory-bundle` workflow to produce complete or partial
  bundle artifacts.
- A governed `/import-memory-bundle` workflow to validate a portable bundle and
  prepare a candidate manifest without auto-activating it.
- Bundle-aware manifest provenance through `sourceTransport: "bundle"` and
  persisted `bundleMetadata`.
- Lifecycle coverage proving that bundle-derived candidates preserve transport
  traceability through activation and rollback.

## How To Export A Bundle

### Prepare the export

- Run `/export-memory-bundle`.
- Provide the explicit source version ID to export.
- Choose which scopes to include: `memories`, `memoir`, `feedback`, or all.
- Provide a file name or subpath inside `.exportsmemories/`.
- Provide the Owner context for why the bundle is being created.

### What the export produces

The workflow generates a `*.memory-bundle.json.gz` file inside
`.exportsmemories/` and reports:

- the source workspace
- the source version
- the included scopes
- the omitted scopes
- the final governed output path

The resulting artifact is transport-only. It is not an active memory version by
itself.

## How To Import A Bundle

### Prepare a bundle-backed candidate

- Run `/import-memory-bundle`.
- Provide the bundle path relative to `.exportsmemories/`.
- Provide the target candidate version ID.
- Provide the Owner context.
- Define the `retain`, `complement`, and `discard` decisions.

### What happens during import

The workflow:

- validates bundle structure and provenance
- verifies the `sha256` payload digest
- rejects incompatible or tampered bundles before creating a candidate
- prepares a bundle-backed candidate manifest
- leaves `active.json` unchanged until explicit activation approval

## Activation And Rollback

### Activate only after review

After import, the Owner still reviews:

- source workspace and source version
- target version ID
- included and omitted scopes
- Owner context
- retain/complement/discard decisions
- current active version and immediate rollback target

Only after explicit approval does the candidate become active.

### Rollback behavior

If a bundle-sourced activation degrades the workspace memory, the Owner can use
the existing rollback path to restore the registered previous version. Bundle
provenance remains attached to the rolled-back manifest for auditability.

## What Gets Recorded

Each export or import records:

- the bundle artifact under `.exportsmemories/`
- a candidate or active manifest under
  `.specify/memory/versions/manifests/{workspace}/`
- bundle provenance and integrity metadata inside the manifest when the source
  transport is offline
- dynamic constitution snapshots under
  `.specify/memory/versions/constitutions/{workspace}/`
- ICM memories describing export, import, verification, and archive state

## Guardrails

- Exported artifacts must stay inside `.exportsmemories/`.
- Unsupported scopes are rejected.
- Bundle file names must end with `.memory-bundle.json.gz`.
- Imports refuse malformed, tampered, or provenance-free bundles.
- Bundle imports never auto-activate.
- The existing rollback model still restores only the registered previous
  version in this iteration.

## Notable Edge Cases

- A partial export must declare omitted scopes explicitly.
- A bundle with a mismatched digest is rejected before candidate creation.
- A bundle without source provenance is rejected immediately.
- The current `memoir` scope is exported as structured JSON, while `memories`
  and `feedback` currently travel as governed CLI snapshots because ICM does not
  yet expose a richer structured full-export API for those surfaces.

## Summary

Workspace memory can now travel offline as a governed compressed bundle without
breaking the existing lifecycle. The Owner can export a portable artifact,
import it into a governed candidate, approve activation explicitly, and still
rely on the same rollback contract already used by live workspace sync.