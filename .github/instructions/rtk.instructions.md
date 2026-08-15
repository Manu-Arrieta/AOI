---
applyTo: "**"
---

# RTK — Token-Optimized CLI (MANDATORY)

**rtk** is a CLI proxy that filters and compresses command outputs before they reach the LLM context, saving 60–90% tokens. Its use is **NOT optional** — it must be used for ALL applicable shell commands.

---

## Rule: Always Prefix Shell Commands with `rtk`

| Direct Command | Token-Optimized `rtk` Command |
| :--- | :--- |
| `git status` | `rtk git status` |
| `git log -10` | `rtk git log -10` |
| `ls` / `ls -la` | `rtk ls` |
| `find . -name "*.py"` | `rtk find . -name "*.py"` |
| `grep -r "pattern" .` | `rtk grep -r "pattern" .` |
| `docker ps` | `rtk docker ps` |
| `docker logs <container>` | `rtk docker logs <container>` |
| `pnpm test` / `npm test` | `rtk test pnpm test` |
| `pytest` | `rtk test pytest` |
| `cat file.json` | `rtk json file.json` |
| `diff a.txt b.txt` | `rtk diff a.txt b.txt` |

---

## Exceptions (When NOT to use `rtk`)

* **Package installations**: `pnpm install`, `brew install`, `pip install`, `winget install`.
* **Interactive commands**: Commands requiring an interactive TTY.
* **ICM commands**: `icm` is a separate binary, NEVER prefix it (`icm store`, `icm recall`, `icm memoir`).
* **Specify commands**: `specify init`, `specify run`, etc.
* **Meta commands**: Use directly (`rtk gain`, `rtk discover`, `rtk gain --history`).
