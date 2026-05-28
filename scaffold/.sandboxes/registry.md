# Sandbox Registry

> Sandboxes are **optional** isolated environments for prototyping features before integrating them into the main codebase.

## Active Sandboxes

| Sandbox | Feature | Status | Created | Last Modified |
| ------- | ------- | ------ | ------- | ------------- |

## Status Legend

| Status         | Description                                |
| -------------- | ------------------------------------------ |
| 🟢 Active      | Sandbox in use, receiving iterations       |
| 🔄 Integrating | Migration to main codebase in progress     |
| 📦 Archived    | Sandbox closed, code migrated or discarded |
| ⏸️ Paused      | Temporarily inactive                       |

## Usage

- Create a sandbox: `/sandbox-new`
- Each sandbox has its own config in `.sandboxes/{name}/config.md`
- Config changes are tracked in `.sandboxes/{name}/changelog.md`
- Export/import via `.sandboxes/{name}/exports/`
