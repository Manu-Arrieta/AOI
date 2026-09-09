---
name: rtk
description: RTK CLI proxy for token-optimized command output. Prefix all shell commands with `rtk` to save 60-90% tokens. Use when running terminal commands — builds, tests, git operations, file searches.
---

# RTK — Token-Optimized CLI

RTK is a CLI proxy that filters and compresses command outputs before they reach the LLM context, saving 60-90% tokens. Its use is NOT optional — it must be used for ALL applicable shell commands.

## Usage

Always prefix shell commands with `rtk`:

```bash
# Instead of:              Use:
git status                 rtk git status
git log -10                rtk git log -10
ls -la                     rtk ls
find . -name "*.py"        rtk find . -name "*.py"
grep -r "pattern" .         rtk grep -r "pattern" .
docker ps                  rtk docker ps
docker logs <ctr>          rtk docker logs <ctr>
npm test                   rtk test npm test
pytest                     rtk test pytest
cat file.json              rtk json file.json
diff a.txt b.txt           rtk diff a.txt b.txt
```

## When NOT to use RTK

- Installing packages (`brew install`, `pip install`, `npm install`)
- Interactive TTY commands
- `rtk` meta commands themselves
- ICM commands (`icm store`, `icm recall`, etc.)
- `specify` commands

## Commands that bypass RTK

A `PreToolUse` hook enforces RTK prefixing when the harness has loaded it — `setup.sh` wires `.github/hooks/rtk-rewrite.json` into `.claude/settings.json`, and `pnpm aoi:hooks` reports whether it took. Do not rely on it: prefix commands yourself. Some are whitelisted and pass through unchanged:

- `icm`, `specify`, `rtk`, `cd`, `corepack`, `pnpm`, `chmod`, `mkdir`, `echo`, `true`

## Token Savings Dashboard

```bash
rtk gain              # Show token savings
rtk gain --history    # Per-command savings history
rtk discover          # Find missed RTK opportunities
```
