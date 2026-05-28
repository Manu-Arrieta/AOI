---
name: "rtk"
description: "Token-optimized CLI usage with RTK proxy. MANDATORY for all shell commands."
metadata:
  author: "aoi"
  source: "scaffold/.agent/skills/rtk/SKILL.md"
---

# RTK — Token-Optimized CLI (MANDATORY)

**rtk** is a CLI proxy that filters and compresses command outputs before they reach the LLM context, saving 60–90% tokens.

This skill is **ALWAYS ACTIVE**. All agents MUST follow it without exception.

## Binary Location

RTK is installed by project setup and is expected to be available as `rtk`.

**NEVER check if RTK is installed. NEVER offer to install it manually.** It is the responsibility of `setup.sh` on macOS/Linux and `setup.ps1` on Windows. If it is missing, tell the user to rerun project setup.

Do **NOT** hardcode OS-specific absolute paths. Use `rtk` directly:

```bash
rtk git status
rtk ls
```

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

- Installing packages (`brew install`, `winget install`, `pip install`, `npm install`)
- Commands that require interactive TTY
- `rtk` meta commands themselves
- **ICM commands** — `icm` is a separate tool, NEVER prefix with `rtk`: use `icm store`, `icm memoir`, etc. directly
- **specify commands** — `specify init`, `specify run`, etc.

## Meta commands (use directly)

```bash
rtk gain              # Token savings dashboard
rtk gain --history    # Per-command savings history
rtk discover          # Find missed rtk opportunities
```

## Enforcement

Any agent that runs a terminal command WITHOUT the `rtk` prefix is violating this protocol. The @supervisor MUST flag non-compliant commands during review.
