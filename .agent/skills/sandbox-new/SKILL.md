# Sandbox New — Create or Evolve Sandbox (Antigravity)

> Antigravity mirror of `.github/prompts/sandbox-new.prompt.md`. Logic is identical.

`/sandbox-new {name}` is the ONLY command that creates or evolves a sandbox, run
**manually**. A sandbox is a multipurpose isolated environment holding **N typed
compartments**, governed by a **living per-sandbox constitution** plus an
**`integration-manifest.json`** (canonical) and its generated `.md` view. There is
**no `/sandbox-amend`**: evolution == re-running `/sandbox-new` on an existing
sandbox to add a compartment, which triggers a MINOR constitution bump.

## Activation

This skill activates when: "sandbox-new", "nuevo sandbox", "create sandbox", "evolve sandbox", "add compartment", "prototipar", or similar.

## Instructions

You are the Supervisor. Execute these steps IN ORDER.

### Step 1: Detect Workspace + Recall

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

```
icm_memory_recall(query: "context conventions", topic: "{WORKSPACE}-context")
icm_memory_recall(query: "sandbox compartments constitution", topic: "sandbox-{WORKSPACE}-{name}")
```

### Step 2: Detect Branch — CREATE vs EVOLVE (OQ-3)

Deterministic, using two independent signals:

```
exists := isDir(.sandboxes/{name}) AND registry-has-row({name})
```

- `exists = false` → **CREATE** branch (Step 3 → Step 4-CREATE).
- `exists = true` → **EVOLVE** branch (Step 3 → Step 4-EVOLVE).

Both signals are required: a stray directory without a registry row is NOT an
existing sandbox, and a registry row without a directory is NOT either.

### Step 3: Gather Compartment(s)

A sandbox holds one or MORE compartments. On CREATE gather at least one; on EVOLVE
gather exactly the new compartment(s). For **each** compartment collect:

1. **`id`** — kebab-case, unique within the sandbox.
2. **`kind`** — `frontend | backend | api-contract | data | infra | docs`.
3. **`surface`** — `visual-ui | swagger | terminal | storybook | none`.
4. **`scope`** — string array of dirs/modules touched.
5. **`stack`** — string array of stack constraints.
6. **`integrationTarget`** — `{rootKey}:{relative-path}` (`rootKey ∈ {frontend, backend, sharedLibs}`) OR the literal `visualization-only`.
7. **`chain`** — `kind = backend` REQUIRES `["route/controller","service","repository","data-client"]`; `kind = frontend` recommends `["page/flow","store/state","service","execution-client"]`.

Also collect once: **Owner**, optional **Related TASK-ID**, and a short **purpose**
for the changelog rationale.

> Doctrine (preserved): components, pages, and stores MUST NOT contain runtime
> selection between real and temporary implementations. Temporary behavior lives in
> sandbox-only adapters, fixtures, or explicit environment flags — never in the
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

1. **`config.md`** — static identity, immutable after this write: Metadata (Created,
   Owner, Related Task, Status) + a **Compartments snapshot** table
   (`id | kind | surface | integration-target`, identity snapshot only — the
   authoritative copy is the manifest) + Rules (config IMMUTABLE; governance in
   constitution.md; integration intent in the manifest).

2. **`constitution.md`** — render from `.sandboxes/_templates/constitution.template.md`
   at **`v1.0.0`**. Substitute `{{SANDBOX_NAME}}` and `{{CREATED_DATE}}`. For EACH
   declared compartment, emit one governance block between the
   `<!-- COMPARTMENT_GOVERNANCE_START -->` / `<!-- COMPARTMENT_GOVERNANCE_END -->`
   markers, substituting `{{COMPARTMENT_KIND}}`, `{{COMPARTMENT_SURFACE}}`,
   `{{COMPARTMENT_ID}}`, `{{COMPARTMENT_SCOPE}}`, `{{COMPARTMENT_STACK}}`,
   `{{COMPARTMENT_INTEGRATION_TARGET}}`, `{{COMPARTMENT_CHAIN}}`. Sync Impact Report
   header records `0.0.0 -> 1.0.0`. Trailing line:
   `**Version**: 1.0.0 | **Created**: {date} | **Last Amended**: {date}`.

3. **`integration-manifest.json`** — render from
   `.sandboxes/_templates/integration-manifest.template.json` (substitute
   `{{SANDBOX_NAME}}`, `{{GENERATED_AT}}`), then **SEED** `compartments[]` with every
   declared compartment (each `addedInConstitutionVersion = "1.0.0"`). Leave
   `elements: []` (incremental population happens later).

4. **`changelog.md`** — initial row `| 1.0.0 | {date} | Initial creation ({kind}:{surface}, …) | {purpose} |`.

5. **`exports/`** — empty directory.

6. **Validate**: `node scripts/sandbox/validate-manifest.mjs .sandboxes/{name}/integration-manifest.json` — non-zero exit = STOP and fix.

7. **Generate**: `node scripts/sandbox/generate-manifest-md.mjs .sandboxes/{name}/integration-manifest.json` — writes the sibling `integration-manifest.md` (never hand-edit it).

8. **Register**: add a `.sandboxes/registry.md` row including the **Compartments**
   column (comma-separated `{kind}:{surface}` tags):
   `| {name} | {feature/TASK-ID or —} | {kind}:{surface}, … | 🟢 Active | {date} | {date} |`.

9. **Persist** in ICM:
   ```
   icm_memory_store(
     topic: "sandbox-{WORKSPACE}-{name}",
     importance: "high",
     content: "## Sandbox Created: {name} (v1.0.0)\nCompartments: {kind}:{surface}, …\nRelated Task: {TASK-ID or None}\nIntegration targets: {targets}\nDoctrine: no runtime selection of temp impls; migratable chain preserved per compartment."
   )
   ```

Proceed to **Step 5**.

---

### Step 4-EVOLVE: Add Compartment(s) to an Existing Sandbox

1. **Confirm with the Owner** before mutating anything:
   > "Sandbox `{name}` already exists. This will ADD compartment(s) `{kind}:{surface}, …`,
   > MINOR-bump its constitution, and extend the manifest. `config.md` will NOT be
   > touched. Proceed?"

   Stop if the Owner declines.

2. **`config.md` is NEVER modified** on evolve — it is immutable identity.

3. **MINOR-bump `constitution.md`** (in order):
   1. Read current `**Version**: X.Y.Z`.
   2. Compute `X.(Y+1).0` (e.g. `1.0.0 → 1.1.0`).
   3. Refresh the Sync Impact Report header: `Version change: X.Y.Z -> X.(Y+1).0`, trigger = `compartment added ({kind}:{surface})`.
   4. Append one governance block per new compartment to `## Compartment Governance`.
   5. Update trailing line: `**Version**: X.(Y+1).0 | **Created**: {orig} | **Last Amended**: {date}`.

4. **Append a `changelog.md` row**: `| {new-version} | {date} | Added compartment {kind}:{surface} | {rationale} |`.

5. **Extend the manifest**: append each new compartment to
   `integration-manifest.json.compartments[]` with
   `addedInConstitutionVersion = "{new-version}"`; refresh `generatedAt`; leave
   `elements[]` untouched.

6. **Re-validate**: `node scripts/sandbox/validate-manifest.mjs .sandboxes/{name}/integration-manifest.json` — non-zero exit = STOP and fix.

7. **Regenerate**: `node scripts/sandbox/generate-manifest-md.mjs .sandboxes/{name}/integration-manifest.json`.

8. **Update the registry row** for `{name}`: extend the **Compartments** column with the new `{kind}:{surface}` tag(s) and refresh **Last Modified**.

9. **Persist** in ICM:
   ```
   icm_memory_store(
     topic: "sandbox-{WORKSPACE}-{name}",
     importance: "high",
     content: "## Sandbox Evolved: {name} (v{new-version})\nAdded compartments: {kind}:{surface}, …\nConstitution: MINOR bump {old} → {new}\nconfig.md: untouched (immutable)."
   )
   ```

Proceed to **Step 5**.

---

### Step 5: Confirm

- CREATE:
  > "Sandbox `{name}` created at constitution `v1.0.0` with compartment(s) `{kind}:{surface}, …`. Manifest validated and `.md` generated. Start prototyping — keep temporary behavior isolated from the integration path. When ready, `/sdd-verify` validates the manifest and plans migration."

- EVOLVE:
  > "Sandbox `{name}` evolved to constitution `v{new-version}` (added `{kind}:{surface}, …`). `config.md` untouched; changelog + manifest updated and re-validated. Continue prototyping."
