---
name: rtk
description: RTK CLI proxy for token-optimized command output. Prefix all shell commands with `rtk` to save 60-90% tokens. Use when running terminal commands — builds, tests, git operations, file searches.
---

# RTK — Token-Optimized CLI

La regla completa —tabla de comandos, excepciones y lista blanca— vive en
`.github/instructions/rtk.instructions.md`, que tiene `applyTo: "**"` y por lo tanto
ya está en este contexto. Repetirla acá costaba 502 tokens en cada una de las seis
fases para decir dos veces lo mismo.

Lo esencial, por si la instruction no estuviera cargada:

- Prefijá **todo** comando de shell con `rtk`. No es opcional.
- No prefijes `icm`, `specify`, `rtk` ni instalaciones de paquetes.
- `PASS (0)` nunca es un pase: 0 tests colectados se comprime a algo que se lee
  verde. Reejecutá con `rtk proxy` antes de concluir.
