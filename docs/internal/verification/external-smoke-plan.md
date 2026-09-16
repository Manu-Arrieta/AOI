# AOI External Smoke Plan

This plan verifies AOI both as a public repository and as a downstream bootstrapper.

## Scope

- Clean public repository baseline.
- Local AOI runtime behavior.
- Downstream project bootstrap behavior.
- Critical failure modes around `icm`, `rtk`, and dashboard prerequisites.

## Shared Prerequisites

- Git
- VS Code with GitHub Copilot
- `icm`
- Node `>=20.19.0`
- `corepack` or `pnpm >=11.3.0`

## Baseline Repository Check

1. Clone AOI at tag `v0.1.0`.
2. Verify `.tasks/registry.md` contains only empty tables.
3. Verify `.sandboxes/registry.md` contains no active sandbox rows.
4. Verify `.specify/memory/versions/active.json` contains an empty `workspaceStates` object.

Expected result:

- The repository opens as a clean starter baseline with no historical operational data.

## macOS/Linux Smoke

1. Run `corepack pnpm install` or `pnpm install` from the AOI root.
2. Run `pnpm dev:dashboard`.
3. Open the dashboard and confirm it renders without inherited tasks or parse errors.
4. Run `pnpm test:dashboard`.
5. Run `pnpm test:memory-sync`.

Expected result:

- Dependencies install without manual repair.
- The dashboard loads against the empty registries.
- Dashboard and memory-sync tests pass.

## Windows Smoke

1. Open PowerShell in the AOI root.
2. Run `corepack pnpm install` or `pnpm install`.
3. Run `pnpm dev:dashboard`.
4. Open the dashboard and confirm it renders without inherited tasks or parse errors.
5. Run `pnpm test:dashboard`.
6. Run `pnpm test:memory-sync`.

Expected result:

- Dependencies install and the dashboard runtime works the same way as on macOS/Linux.
- The validation suite passes under Windows too.

## Downstream Bootstrap Smoke

1. Create a new scratch repository with a minimal `README.md` and initialize Git.
2. On macOS/Linux run `bash "/path/to/AOI/setup.sh" --profile core "/path/to/scratch-repo"`.
3. On Windows run `powershell -NoProfile -ExecutionPolicy Bypass -File "C:\path\to\AOI\setup.ps1" -Profile core "C:\path\to\scratch-repo"`.
4. Open the bootstrapped project in VS Code.
5. Verify the project now includes AOI runtime surfaces such as `.github/agents/`, `.github/prompts/`, `.vscode/mcp.json`, `.specify/`, and `.resources/`, and does not materialize `aoi_apps/agentic-ops-dashboard/package.json`.
6. Run `/init` and then `/sdd-new` from Copilot Chat.
7. In a second independent scratch repository, repeat the install with `--profile dashboard` (or `-Profile dashboard` in PowerShell) and verify that `aoi_apps/agentic-ops-dashboard/package.json` is now present without dashboard workspace files at the repository root.

Expected result:

- The project receives the AOI scaffold successfully.
- Copilot prompts, agents, and ICM MCP registration are present.
- The first workflow can start without inherited task history.
- Core adds neither dashboard artifacts nor dependencies; Dashboard adds both only when explicitly selected.

## Failure-Mode Checks

1. Try setup on a machine where `icm` is unavailable.
2. Try setup with `rtk` unavailable or with its install path intentionally failing.
3. With `--profile dashboard`, try setup without Node `>=20.19.0`.
4. With `--profile dashboard`, try setup without `corepack` and without `pnpm >=11.3.0`.

Expected result:

- Missing `icm` blocks setup.
- Missing or failed `rtk` does not block setup.
- Missing dashboard runtime prerequisites block the Dashboard profile before dependency installation; Core never reaches that phase.

## Exit Criteria

- Public AOI repository is clean at clone time.
- AOI runtime installs and runs on macOS/Linux and Windows.
- Downstream bootstrap produces a clean governed workspace.
- Failure handling matches the documented policy for `icm`, `rtk`, installation profiles, and dashboard prerequisites.
