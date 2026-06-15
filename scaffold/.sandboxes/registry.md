# Sandbox Registry

> Sandboxes are **optional** isolated environments for prototyping features before integrating them into the main codebase.

## Active Sandboxes

| Sandbox | Feature | Compartments | Status | Created | Last Modified |
| ------- | ------- | ------------ | ------ | ------- | ------------- |

> `Compartments` is a comma-separated list of `{kind}:{surface}` tags (e.g.
> `frontend:visual-ui, backend:swagger`), derived from
> `.sandboxes/{name}/integration-manifest.json.compartments[]`.

## Status Legend

| Status         | Description                                |
| -------------- | ------------------------------------------ |
| 🟢 Active      | Sandbox in use, receiving iterations       |
| 🔄 Integrating | Migration to main codebase in progress     |
| 📦 Archived    | Sandbox closed, code migrated or discarded |
| ⏸️ Paused      | Temporarily inactive                       |

## Usage

- Create or evolve a sandbox: `/sandbox-new` (the single manual entry point — there is no `/sandbox-amend`).
- Each sandbox holds **N typed compartments** (`{kind}:{surface}`) recorded in the **Compartments** column.
- Static identity lives in `.sandboxes/{name}/config.md` (immutable after creation).
- Living governance lives in `.sandboxes/{name}/constitution.md` (versioned; MINOR bump per added compartment).
- Integration intent lives in `.sandboxes/{name}/integration-manifest.json` (canonical) with the generated `.sandboxes/{name}/integration-manifest.md` view.
- Amendment history is tracked in `.sandboxes/{name}/changelog.md`.
- Export/import via `.sandboxes/{name}/exports/`.
