---
applyTo: "**"
---

# RTK — Token-Optimized CLI (MANDATORY)

**rtk** is a CLI proxy that filters and compresses command outputs before they reach the LLM context, saving 60–90% tokens. Its use is **NOT optional** — it must be used for ALL applicable shell commands.

## Binary Location

RTK is installed by project setup (`setup.sh` on macOS/Linux, `setup.ps1` on Windows) and is expected to be available as `rtk`.

**NEVER check if RTK is installed. NEVER offer to install it manually.** If `rtk` is not found in PATH, tell the user to rerun project setup. Do **NOT** hardcode `/opt/homebrew/bin/rtk` or any other OS-specific absolute path.

## Rule

Always prefix shell commands with `rtk`:

```bash
# Instead of:              Use:
git status                 rtk git status
git log -10                rtk git log -10
ls / ls -la                rtk ls
find . -name "*.py"        rtk find . -name "*.py"
grep -r "pattern" .        rtk grep -r "pattern" .
docker ps                  rtk docker ps
docker logs <container>    rtk docker logs <container>
npm test / pnpm test       rtk test npm test
pytest                     rtk test pytest
cat file.json              rtk json file.json
diff a.txt b.txt           rtk diff a.txt b.txt
```

## When NOT to use rtk

- Installing packages (`brew install`, `winget install`, `pip install`, `npm install`) — no filtering needed
- Commands that require interactive TTY
- `rtk` meta commands themselves
- **ICM commands** — `icm` is a separate tool, never prefix it: `icm store ...`, `icm memoir ...`, `icm serve`
- **specify commands** — `specify init`, `specify run`, etc.

## Meta commands (use directly, no prefix)

```bash
rtk gain              # Token savings dashboard
rtk gain --history    # Per-command savings history
rtk discover          # Find missed rtk opportunities
```

## Enforcement

The `PreToolUse` hook in `.github/hooks/rtk-rewrite.json` automatically rewrites terminal commands. If RTK is not available, commands still run unfiltered — but **you** must still apply the prefix in all code you generate.
