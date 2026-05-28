# Archive Report — TASK-2026-004

## Summary

TASK-2026-004 introduced a workflow-first memory versioning layer for `aoi`
so cross-workspace ICM memory imports can be prepared, reviewed, activated, and
reverted without ambiguous writes into the live workspace context. The task
established a governed version store under `.specify/memory/versions/`, added
deterministic lifecycle scripts for active-version resolution, candidate
preparation, activation, and rollback, updated the shared ICM protocol across
Copilot and Antigravity, and documented the new `/sync-workspace-memory` and
`/rollback-workspace-memory` workflows. Verification passed and the feature is
now formally archived.

## Artifacts Produced

| Artifact | Path | Status |
|----------|------|--------|
| Proposal | `.tasks/workspace-memory-sync/TASK-2026-004/proposal.md` | ✅ |
| Requirement | `.tasks/workspace-memory-sync/TASK-2026-004/requirement.md` | ✅ |
| Spec | `.tasks/workspace-memory-sync/TASK-2026-004/spec.md` | ✅ |
| Design | `.tasks/workspace-memory-sync/TASK-2026-004/design.md` | ✅ |
| Tasks | `.tasks/workspace-memory-sync/TASK-2026-004/tasks.md` | ✅ |
| Implementation Plan | `.tasks/workspace-memory-sync/TASK-2026-004/implementation-plan.md` | ✅ |
| Iteration Log | `.tasks/workspace-memory-sync/TASK-2026-004/iterations/2026-05-27-apply-01.md` | ✅ |
| Iteration Log | `.tasks/workspace-memory-sync/TASK-2026-004/iterations/2026-05-27-apply-02.md` | ✅ |
| Iteration Log | `.tasks/workspace-memory-sync/TASK-2026-004/iterations/2026-05-27-apply-03.md` | ✅ |
| Verify Report | `.tasks/workspace-memory-sync/TASK-2026-004/verify-report.md` | ✅ PASS |
| Functional Docs | `.tasks/workspace-memory-sync/TASK-2026-004/functional-docs.md` | ✅ |
| Archive Report | `.tasks/workspace-memory-sync/TASK-2026-004/archive-report.md` | ✅ |

## Key Decisions

- Memory sync was implemented as a workflow-first infrastructure feature rather
  than a dashboard UI feature because the contract needed to stabilize before
  any visual surface was added.
- `active.json` was established as the canonical active-memory pointer so the
  rest of the system does not infer current state from bare topic aliases.
- Candidate preparation, activation, and rollback were split into separate
  deterministic scripts to keep auditability and avoid prompt-only mutations.
- Rollback was intentionally limited to the registered `previousVersionId` so
  restoration remains explicit and safe in this first iteration.
- Shared protocol and workflow changes were mirrored across root, `scaffold/`,
  Copilot, and Antigravity to avoid cross-surface drift.

## What Was Deliberately Excluded

- Any dashboard or browser UI for browsing memory versions.
- Automatic sync activation without explicit Owner review.
- Arbitrary rollback to any historical version beyond the registered previous
  version.
- Direct mutation of ICM operational state by prompt inference instead of the
  managed lifecycle scripts.
- A turnkey CLI wrapper for every lifecycle script beyond the active-version
  resolver.

## Services Discovered/Created

- `apps/agentic-ops-dashboard/server/utils/build-workspace-snapshot.ts` +
  `apps/agentic-ops-dashboard/server/api/workspace.get.ts` +
  `apps/agentic-ops-dashboard/server/routes/events.ts` +
  `apps/agentic-ops-dashboard/app/composables/useWorkspace.ts`: existing
  workspace snapshot and realtime surface discovered during `/sdd-new` to
  confirm current runtime scope and the absence of memory-version entities.
- `scripts/memory-sync/resolve-active-version.mjs`: canonical resolver for the
  active and previous workspace memory versions.
- `scripts/memory-sync/prepare-version-manifest.mjs`: candidate manifest and
  dynamic constitution generator.
- `scripts/memory-sync/activate-version.mjs`: candidate promotion and active
  pointer update.
- `scripts/memory-sync/rollback-version.mjs`: restoration of the registered
  previous version with explicit rolled-back traceability.
- `.github/prompts/sync-workspace-memory.prompt.md`: governed sync workflow.
- `.github/prompts/rollback-workspace-memory.prompt.md`: governed rollback
  workflow.

## Lessons Learned

- Version-store fixtures need version-root-relative path resolution for
  templates and constitution snapshots; repository-root assumptions were too
  brittle for isolated tests.
- Shared infrastructure changes must be treated as one atomic surface across
  root, `scaffold/`, Copilot, and Antigravity or drift appears quickly.
- Service-discovery evidence may exist only in ICM and still needs direct recall
  during verify rather than relying on markdown artifacts alone.
- Prompt frontmatter has moved from `mode:` to `agent:` for newly created
  workflow prompts.

## ICM State

- Memories: consolidated for `sdd-aoi-workspace-memory-sync-TASK-2026-004`
- Apply-progress sub-topic: not present, no extra consolidation required
- Memoirs: `aoi-architecture` exported during archive
- Feedback: 1 task-specific correction reviewed from `aoi-workflow`
- Transcripts: archive session recorded under `01KSP2ZYA66TR4XA3XPZD22TB9`

## Files Modified

- `.specify/memory/constitution.md`
- `.specify/memory/versions/README.md`
- `.specify/memory/versions/active.json`
- `.specify/memory/versions/manifests/aoi/aoi-memory-v1.json`
- `.specify/memory/versions/constitutions/aoi/aoi-memory-v1.md`
- `.specify/memory/versions/templates/memory-version.template.json`
- `.specify/memory/versions/templates/dynamic-constitution.template.md`
- `.github/instructions/icm-protocol.instructions.md`
- `.github/prompts/sync-workspace-memory.prompt.md`
- `.github/prompts/rollback-workspace-memory.prompt.md`
- `.agent/skills/_shared/icm-protocol.md`
- `.agent/skills/sync-workspace-memory/SKILL.md`
- `.agent/skills/rollback-workspace-memory/SKILL.md`
- `scripts/memory-sync/schema.mjs`
- `scripts/memory-sync/resolve-active-version.mjs`
- `scripts/memory-sync/store-utils.mjs`
- `scripts/memory-sync/prepare-version-manifest.mjs`
- `scripts/memory-sync/activate-version.mjs`
- `scripts/memory-sync/rollback-version.mjs`
- `scripts/memory-sync/resolve-active-version.test.mjs`
- `scripts/memory-sync/prepare-version-manifest.test.mjs`
- `scripts/memory-sync/activate-version.test.mjs`
- `scripts/memory-sync/rollback-version.test.mjs`
- `scripts/memory-sync/fixtures/valid/active.json`
- `scripts/memory-sync/fixtures/valid/manifests/fixture-workspace/fixture-v1.json`
- `scripts/memory-sync/fixtures/valid/manifests/fixture-workspace/fixture-v2.json`
- `scripts/memory-sync/fixtures/valid/constitutions/fixture-workspace/fixture-v1.md`
- `scripts/memory-sync/fixtures/valid/constitutions/fixture-workspace/fixture-v2.md`
- `scripts/memory-sync/fixtures/valid/templates/memory-version.template.json`
- `scripts/memory-sync/fixtures/valid/templates/dynamic-constitution.template.md`
- `README.md`
- `README.es.md`
- `package.json`
- `scaffold/.specify/memory/constitution.md`
- `scaffold/.specify/memory/versions/README.md`
- `scaffold/.specify/memory/versions/active.json`
- `scaffold/.specify/memory/versions/manifests/.gitkeep`
- `scaffold/.specify/memory/versions/constitutions/.gitkeep`
- `scaffold/.specify/memory/versions/templates/memory-version.template.json`
- `scaffold/.specify/memory/versions/templates/dynamic-constitution.template.md`
- `scaffold/.github/instructions/icm-protocol.instructions.md`
- `scaffold/.github/prompts/sync-workspace-memory.prompt.md`
- `scaffold/.github/prompts/rollback-workspace-memory.prompt.md`
- `scaffold/.agent/skills/_shared/icm-protocol.md`
- `scaffold/.agent/skills/sync-workspace-memory/SKILL.md`
- `scaffold/.agent/skills/rollback-workspace-memory/SKILL.md`
- `.tasks/registry.md`
- `.tasks/workspace-memory-sync/feature.md`
- `.tasks/workspace-memory-sync/TASK-2026-004/context.md`
- `.tasks/workspace-memory-sync/TASK-2026-004/tasks.md`
- `.tasks/workspace-memory-sync/TASK-2026-004/iterations/2026-05-27-apply-01.md`
- `.tasks/workspace-memory-sync/TASK-2026-004/iterations/2026-05-27-apply-02.md`
- `.tasks/workspace-memory-sync/TASK-2026-004/iterations/2026-05-27-apply-03.md`
- `.tasks/workspace-memory-sync/TASK-2026-004/verify-report.md`
- `.tasks/workspace-memory-sync/TASK-2026-004/functional-docs.md`
- `.tasks/workspace-memory-sync/TASK-2026-004/archive-report.md`