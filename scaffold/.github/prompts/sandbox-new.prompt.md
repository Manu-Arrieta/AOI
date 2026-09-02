---
description: "Create or evolve a multipurpose sandbox (compartments + living constitution + integration manifest). The single manual entry point — there is no /sandbox-amend. Optional workflow."
agent: "agent"
---

# /sandbox-new — Create or Evolve Sandbox

`/sandbox-new {name}` is the ONLY command that creates or evolves a sandbox, and
it is run **manually**. A sandbox is a multipurpose isolated environment holding
**N typed compartments**, governed by a **living per-sandbox constitution** and an
**`integration-manifest.json`** (canonical) plus its generated `.md` view.

There is **no `/sandbox-amend`**: evolution == re-running `/sandbox-new` on an
existing sandbox to add a compartment, which triggers a MINOR constitution bump.

## Instructions

You are the @supervisor. Execute these steps IN ORDER.

### Step 1: Detect Workspace + Recall (Sandbox Isolation)

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

```
icm_memory_recall(query: "context conventions", topic: "{WORKSPACE}-context")
icm_memory_recall(query: "sandbox compartments constitution", topic: "sandbox-{WORKSPACE}-{name}")
```

> **ICM Sandbox Isolation Policy (MANDATORY)**: When running exploratory code, evaluations, or benchmarks inside `.sandboxes/{name}/`, export `ICM_READONLY=1` or pass `--read-only` to prevent accidental mutation of the core project memory database. All sandbox writes MUST strictly target `sandbox-{WORKSPACE}-{name}` topics.

### Step 2: Detect Branch — CREATE vs EVOLVE (OQ-3)

Branch detection is deterministic and uses **two independent signals**:

```
exists := isDir(.sandboxes/{name}) AND registry-has-row({name})
```

- `exists = false` → **CREATE** branch (Step 3 → Step 4-CREATE).
- `exists = true` → **EVOLVE** branch (Step 3 → Step 4-EVOLVE).

Both signals are required: a stray directory without a registry row is NOT an
existing sandbox, and a registry row without a directory is NOT either.

### Step 3: Gather Compartment(s)

A sandbox holds one or MORE compartments. On CREATE, gather at least one; on
EVOLVE, gather exactly the new compartment(s) being added. For **each**
compartment collect:

1. **`id`** — kebab-case, unique within the sandbox (e.g. `auth-ui`, `auth-api`).
2. **`kind`** — one of `frontend | backend | api-contract | data | infra | docs`.
3. **`surface`** — one of `visual-ui | swagger | terminal | storybook | none`.
4. **`scope`** — string array: dirs/modules the compartment touches (e.g.
   `[".sandboxes/{name}/ui"]`).
5. **`stack`** — string array: stack constraints for this compartment.
6. **`integrationTarget`** — a base-project target token `{rootKey}:{relative-path}`
   (`rootKey ∈ {frontend, backend, sharedLibs}`) OR the literal `visualization-only`.
7. **`chain`** — the migratable chain:
   - `kind = backend` → REQUIRED `["route/controller", "service", "repository", "data-client"]`.
   - `kind = frontend` → recommended `["page/flow", "store/state", "service", "execution-client"]`.

Also collect once for the sandbox: **Owner**, optional **Related TASK-ID**, and a
short **purpose** for the changelog rationale.

> Doctrine (preserved): components, pages, and stores MUST NOT contain runtime
> selection between real and temporary implementations. Temporary behavior lives
> in sandbox-only adapters, fixtures, or explicit environment flags — never in the
> integration path. Every migratable element preserves its chain so it can be
> cleanly lifted into the base project on integration.

---

### Step 4-CREATE: Scaffold a New Sandbox

Produce **exactly** the FR-3 layout:

```text
.sandboxes/{name}/
├── config.md                  ← static identity (IMMUTABLE post-creation)
├── constitution.md            ← living governance, v1.0.0, subordinate to root
├── integration-manifest.json  ← canonical, machine-validated (skeleton, SEEDED)
├── integration-manifest.md    ← GENERATED human view (never hand-edited)
├── changelog.md               ← amendment history (Sync Impact Reports)
└── exports/                   ← exportable snapshots
```

1. **`config.md`** — static identity, immutable after this write. Includes
   Metadata (Created, Owner, Related Task, Status) and a **Compartments snapshot**
   table (`id | kind | surface | integration-target`) — an identity snapshot only;
   the authoritative copy lives in the manifest.

   ```markdown
   # Sandbox: {name}

   ## Metadata

   - **Created**: {date}
   - **Owner**: {user}
   - **Related Task**: {TASK-ID or "None"}
   - **Status**: 🟢 Active

   ## Compartments (snapshot at creation — authoritative copy in manifest)

   | id   | kind   | surface   | integration-target  |
   | ---- | ------ | --------- | ------------------- |
   | {id} | {kind} | {surface} | {integrationTarget} |

   ## Rules

   1. This config is IMMUTABLE — evolution happens via `/sandbox-new` re-run.
   2. Governance lives in constitution.md; integration intent lives in the manifest.
   ```

2. **`constitution.md`** — render from
   `.sandboxes/_templates/constitution.template.md` at **`v1.0.0`**. Substitute
   `{{SANDBOX_NAME}}` and `{{CREATED_DATE}}`. For EACH declared compartment, emit a
   governance block between the `<!-- COMPARTMENT_GOVERNANCE_START -->` /
   `<!-- COMPARTMENT_GOVERNANCE_END -->` markers (one block per compartment),
   substituting `{{COMPARTMENT_KIND}}`, `{{COMPARTMENT_SURFACE}}`,
   `{{COMPARTMENT_ID}}`, `{{COMPARTMENT_SCOPE}}`, `{{COMPARTMENT_STACK}}`,
   `{{COMPARTMENT_INTEGRATION_TARGET}}`, `{{COMPARTMENT_CHAIN}}`. The Sync Impact
   Report header records `0.0.0 -> 1.0.0`. Trailing line:
   `**Version**: 1.0.0 | **Created**: {date} | **Last Amended**: {date}`.

3. **`integration-manifest.json`** — render from
   `.sandboxes/_templates/integration-manifest.template.json`. Substitute
   `{{SANDBOX_NAME}}` and `{{GENERATED_AT}}` (ISO), then **SEED** `compartments[]`
   with every declared compartment object (each `addedInConstitutionVersion`
   = `"1.0.0"`). Leave `elements: []` (incremental population happens later as
   elements are built).

4. **`changelog.md`** — initial row:

   ```markdown
   # Changelog — {name}

   | Version | Date   | Change                                 | Rationale |
   | ------- | ------ | -------------------------------------- | --------- |
   | 1.0.0   | {date} | Initial creation ({kind}:{surface}, …) | {purpose} |
   ```

5. **`exports/`** — empty directory.

6. **Validate** the seeded manifest:

   ```bash
   node scripts/sandbox/validate-manifest.mjs .sandboxes/{name}/integration-manifest.json
   ```

   Non-zero exit = STOP and fix the manifest before continuing.

7. **Generate** the `.md` view:

   ```bash
   node scripts/sandbox/generate-manifest-md.mjs .sandboxes/{name}/integration-manifest.json
   ```

   This writes the sibling `integration-manifest.md` (do NOT hand-edit it).

8. **Register**: add a row to `.sandboxes/registry.md` (Active Sandboxes), including
   the **Compartments** column (comma-separated `{kind}:{surface}` tags):

   ```markdown
   | {name} | {feature/TASK-ID or —} | {kind}:{surface}, … | 🟢 Active | {date} | {date} |
   ```

9. **Persist** in ICM:

   ```
   icm_memory_store(
     topic: "sandbox-{WORKSPACE}-{name}",
     importance: "high",
     content: "## Sandbox Created: {name} (v1.0.0)\n**Compartments**: {kind}:{surface}, …\n**Related Task**: {TASK-ID or None}\n**Integration targets**: {targets}\n**Doctrine**: no runtime selection of temp impls; migratable chain preserved per compartment."
   )
   ```

Proceed to **Step 5**.

---

### Step 4-EVOLVE: Add Compartment(s) to an Existing Sandbox

1. **Confirm with the Owner** before mutating anything:

   > "Sandbox `{name}` already exists. This will ADD compartment(s)
   > `{kind}:{surface}, …`, MINOR-bump its constitution, and extend the manifest.
   > `config.md` will NOT be touched. Proceed?"

   Stop if the Owner declines.

2. **`config.md` is NEVER modified** on evolve — it is immutable identity.

3. **MINOR-bump `constitution.md`** (algorithm, in order):
   1. Read the current `**Version**: X.Y.Z`.
   2. Compute `X.(Y+1).0` (e.g. `1.0.0 → 1.1.0`).
   3. Refresh the Sync Impact Report header at the top:
      `Version change: X.Y.Z -> X.(Y+1).0`, trigger = `compartment added ({kind}:{surface})`.
   4. Append one governance block per new compartment to `## Compartment Governance`.
   5. Update the trailing line: `**Version**: X.(Y+1).0 | **Created**: {orig} | **Last Amended**: {date}`.

4. **Append a `changelog.md` row**:

   ```markdown
   | {new-version} | {date} | Added compartment {kind}:{surface} | {rationale} |
   ```

5. **Extend the manifest** `integration-manifest.json`: append each new
   compartment object to `compartments[]` with
   `addedInConstitutionVersion = "{new-version}"`. Refresh `generatedAt`. Leave
   existing `elements[]` untouched.

6. **Re-validate**:

   ```bash
   node scripts/sandbox/validate-manifest.mjs .sandboxes/{name}/integration-manifest.json
   ```

   Non-zero exit = STOP and fix before continuing.

7. **Regenerate** the `.md` view:

   ```bash
   node scripts/sandbox/generate-manifest-md.mjs .sandboxes/{name}/integration-manifest.json
   ```

8. **Update the registry row** for `{name}`: extend the **Compartments** column with
   the new `{kind}:{surface}` tag(s) and refresh **Last Modified**.

9. **Persist** in ICM:

   ```
   icm_memory_store(
     topic: "sandbox-{WORKSPACE}-{name}",
     importance: "high",
     content: "## Sandbox Evolved: {name} (v{new-version})\n**Added compartments**: {kind}:{surface}, …\n**Constitution**: MINOR bump {old} → {new}\n**config.md**: untouched (immutable)."
   )
   ```

Proceed to **Step 5**.

---

### Step 5: Confirm

- CREATE:

  > "Sandbox `{name}` created at constitution `v1.0.0` with compartment(s)
  > `{kind}:{surface}, …`. Manifest validated and `.md` generated. Start
  > prototyping — keep temporary behavior isolated from the integration path. When
  > ready, `/sdd-verify` validates the manifest and plans migration."

- EVOLVE:
  > "Sandbox `{name}` evolved to constitution `v{new-version}` (added
  > `{kind}:{surface}, …`). `config.md` untouched; changelog + manifest updated and
  > re-validated. Continue prototyping."

**Create or evolve a sandbox for:**
{{input}}
