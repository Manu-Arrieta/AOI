---
name: rtk
description: RTK CLI proxy that compresses shell command output before it reaches the model. Prefix all shell commands with `rtk`. Use for terminal commands — builds, tests, git operations, searches.
---

<!-- canonical-instruction: rtk.instructions.md -->

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
