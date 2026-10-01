# Auditoría AOI — gaps, acoplamientos y consumo de tokens

- **Versión auditada:** `v2.5.2-164-g9d62242` (`git describe --tags --dirty`, árbol limpio). Se usa `git describe` y no el tag porque los tags de este repositorio no identifican de forma unívoca el estado medido.
- **Fecha:** 2026-09-30
- **Modelo:** Claude Opus 5.5 (contexto 1M) — `claude-opus-5-5[1m]`, vía Claude Code (extensión VS Code), con tres subagentes general-purpose del mismo modelo.
- **Método:** ejecución real. Se corrió `pnpm test` completo (exit 0, 43 s, 1719 tests node, 1 skip), `aoi:doctor` (14 ok, 1 warning), las compuertas que la cadena no corre, una instalación de punta a punta de `setup.sh --yes` en rutas con espacios (core y dashboard, con `icm` falso para no tocar la base real) y mediciones de bytes (tokens ≈ bytes/4) sobre todo lo que se inyecta en contexto. Toda ejecución que escribía se hizo en copias desechables bajo el scratchpad.

> **Veredicto:** la suite da verde, pero el verde no cubre lo que dice cubrir. Los defectos de mayor impacto no están en `scripts/`: están en el **acoplamiento con el harness**, es decir en los hooks, el MCP y el ICM global. Ahí AOI duplica inyecciones de contexto en cada prompt y contamina la memoria que después le inyecta al modelo.

## A. Consumo de tokens: acoplamientos que multiplican contexto

| # | Hallazgo | Evidencia | Costo medido |
|---|---|---|---|
| A1 | **Los hooks de ICM corren duplicados en Claude Code.** `setup.sh:2106` ejecuta `icm init --mode hook`, que registra hooks en `~/.claude/settings.json` (global). Después, `install-hooks.mjs` cablea `.github/hooks/icm.json` en `.claude/settings.json`, que vuelve a llamar a `icm hook <modo>` por medio de `icm-hook.sh:32`. El instalador se duplica a sí mismo, y `install-hooks.mjs` no deduplica contra el scope de usuario. | Observado en esta sesión: el recall llegó 2× en cada mensaje. | ~2 KB extra **por prompt** que queda en el historial y se relee en cada turno. |
| A2 | **SessionStart inyecta el wake-up 3 veces**: el global, `icm-hook.sh start` y `session-init-hook.sh`, que vuelve a llamar a `icm hook start`. Además, `session-init-hook.sh` imprime `{"continue":true}` después del texto, y ese JSON termina en el contexto como basura. | Observado al arrancar la sesión: tres bloques idénticos. | ~1,6 KB × 2 copias sobrantes por sesión. |
| A3 | **El ICM tiene memoria contaminada que el recall inyecta.** El topic `context-AOI` tiene 363 memorias, 86 de ellas `critical` (nunca decaen), y 74 citan `scripts/aoi-os/`, que no existe. El extractor automático guarda su propio texto de "no hay nada que guardar" como memoria (`01M3TEZVZD422TJY2DQAPWN2PD`, inyectada en esta misma sesión). Hay ~35 topics de workspaces de prueba (`aoi-*.XXXX-context`) filtrados a la base real. Conviven dos espacios de nombres para el mismo proyecto: `context-AOI` (el del extractor) y `AOI-context` (el del protocolo). | `icm topics`, `icm list --topic context-AOI` | Cada recall compite contra cientos de entradas obsoletas: gasta tokens y desinforma. |
| A4 | **`aoi:installed-suite` y los tests que corren `setup.sh` usan el `icm` real**: no hay `--db` en `setup.sh` ni en `installed-suite.mjs`. Esto genera los topics descartables de A3 y ejecuta `icm init --mode hook\|skill\|cli` contra `~/.claude/` del desarrollador. | `rtk proxy rg -- '--db' setup.sh scripts/scaffold/installed-suite.mjs` → 0 resultados | Efecto lateral sobre la configuración global. |
| A5 | **El mcp-gateway sólo existe en VS Code.** `mcp-compressor` envuelve los servidores en `.vscode/mcp.json`, pero en Claude Code ICM corre como `icm serve` **sin comprimir**, desde `~/.claude.json`, y `codebase-memory-mcp` no está registrado. `setup-mcp-gateway.mjs` sólo verifica; `setup.sh` nunca lo invoca. | `jq .mcpServers.icm ~/.claude.json` | El ahorro que se declara es 0 en Claude Code. |
| A6 | **`assemble-phase-context` y `cache-prefix` no los usa ningún prompt, hook ni agente.** Sólo los llaman lentes, compuertas y tests. Además modelan únicamente Copilot, cuentan `supervisor.agent.md` 7× aunque los prompts declaran `agent: "agent"`, y omiten la constitución, los templates de speckit, `extensions.yml`, los hooks y CLAUDE.md. | Callers según `pnpm aoi:graph` | Un lente que nadie consume ahorra 0. |
| A7 | **TOON y el tombstoning no están en ningún camino real.** TOON es opcional (`--format toon`, cuyo valor por defecto es `markdown`) y la prosa sólo lo "recomienda". El tombstone exige `--file <turns.json>`, pero ningún harness exporta sus turnos. | Agente de costo, verificado por grafo | 0 ahorro en ejecución. |
| A8 | **`speckit.plan` reescribe un archivo compilado a mitad de ciclo.** `.github/agents/speckit.plan.agent.md:155` corre `update-agent-context.sh copilot`, que modifica `copilot-instructions.md`. Eso invalida el prefix-cache que estima el propio `cache-prefix` (~39k tokens/ciclo), lo pisa el siguiente `aoi:sync-rules` y lo bloquearía el guard de commit: dos dueños para el mismo archivo. | `rtk proxy rg update-agent-context .github` | Rompe el prefix-cache en Copilot. |
| A9 | **El CLAUDE.md siempre cargado manda a usar salidas caras.** `pnpm aoi:graph` devuelve 38 KB, contra 464 B con `--hubs`. `pnpm aoi:determinism` devuelve 32 KB, contra 108 B con `--summary`. Los modos baratos sólo están documentados en `docs/internal`. Además recomienda `fd -H -I`, que devuelve 1367 `.md`, de los cuales 973 son de `node_modules` (394 con `-E node_modules`). | Medido | ~80–300× más salida de la necesaria. |
| A10 | **Costo por ciclo.** Copilot carga ~90k tokens por ciclo (según `aoi:context`), y el 56 % es repetición: `icm-protocol` (`applyTo: **`) entra en las 7 fases. En Claude Code, `ff` es la fase más cara (~20k): agentes speckit de 31,8 KB, templates de 19 KB y `extensions.yml` leído 4×. La constitución se lee 3 veces por ciclo. Hay ~33 KB de líneas duplicadas entre archivos: el bloque Headroom en 4 prompts (inaplicable a Claude Code), el bloque de resolución de TASK-ID en 4 prompts y la skill `icm` contra `icm-protocol` (7,6 KB compartidos). | Agente de costo | Ver magnitudes. |
| A11 | **Fuera de AOI, pero suma.** El CLAUDE.md global del usuario incluye el protocolo Engram (`mem_save`, etc.), y esas herramientas no existen en la sesión. El protocolo ICM aparece 3 veces: CLAUDE.md global, CLAUDE.md del proyecto e instrucciones del servidor MCP. | Lista de herramientas de la sesión | ~1k+ tokens siempre cargados que no aportan nada. |

## B. Hooks: defectos de funcionamiento

| # | Hallazgo | Evidencia |
|---|---|---|
| B1 | **`rtk-hook.sh` usa el dialecto de Copilot en Claude Code.** `rtk hook copilot` responde `permissionDecision: "ask"`; `rtk hook claude` no lo hace. Fuera del modo bypass, cada comando que RTK reescribe pide permiso. `install-hooks.mjs` traduce la forma del JSON, pero no el dialecto. | Ambos ejecutados con la misma entrada |
| B2 | **`session-close-hook.sh` está cableado en `Stop`, que corre al final de cada turno, no al cerrar la sesión.** Además: llama a `icm hook stop`, que no existe (exit 2, silenciado con `\|\| true`); imprime ~35 KB de `icm health` antes del JSON, lo que rompe el parseo, y su `systemMessage` nunca llega; y borra cada turno el contador del rate-limit de post-tool. | `icm hook --help`; ejecutado |
| B3 | **`post-tool-learning-hook.sh` consume stdin con `cat` antes de llamar a `icm hook post`**, que se queda sin entrada (es un no-op inferido). Encima, PostToolUse dispara `icm hook post` hasta 3 veces por llamada: el global, `icm-hook.sh post` y este hook. | Lectura del script |
| B4 | **El guard de commit no está activo en el repositorio de desarrollo.** No existe `.git/hooks/commit-msg` ni `core.hooksPath`. El CLAUDE.md afirma que bloquea los commits con archivos administrados. En los workspaces instalados sí funciona (verificado). | `git config core.hooksPath` vacío |

## C. Compuertas que reportan verde sin haber medido

| # | Hallazgo | Evidencia |
|---|---|---|
| C1 | **`pnpm test:dashboard` es un no-op silencioso en este repositorio.** El guard `import.meta.url === \`file://${process.argv[1]}\`` de `scripts/multi-harness/dashboard-command.mjs:46` falla con rutas que llevan espacios (`GITHUB%20MIGRATION`). Los 87 tests del dashboard nunca corren en la cadena. Al correrlos a mano, pasan. El defecto ya se había corregido y documentado en `memory-sync` (`cli-surface.test.mjs:11-21`), pero ese arreglo no llegó a este archivo. | `node dashboard-command.mjs bogus` → exit 0 |
| C2 | **`aoi:entry-points` no puede detectar C1, por dos puntos ciegos.** Sólo lee la prosa de `.github/` y nunca `package.json`. Y corre los scripts en una copia bajo `os.tmpdir()`, una ruta sin espacios, que esconde justamente la clase de defecto que motivó la compuerta. | `entry-point-probe.mjs:47-52, 154-170` |
| C3 | **`pnpm test` no corre `aoi:invariant-gate` ni `aoi:blueprint-gate`**, aunque CLAUDE.md, en la sección "Which gate refuses what", afirma que sí. Tampoco corre `aoi:task-artifacts`. | `package.json` → `scripts.test` |
| C4 | **El invariant gate cuenta como evidencia tests que se saltean.** `BIC-2026-003:never.2/never.3` figuran ✅, pero su único test lleva `skip: process.platform !== 'win32'`. `BIC-2026-002:never.2` figura ✅ con un test del dashboard que la cadena nunca ejecuta (C1). | `windows-installer-parity.test.mjs:43` |
| C5 | **Una instalación core da `test:conf` verde sobre 0 tests**, porque `scripts/conf/` no se instala y `aoi:test-globs` en modo lenient lo deja pasar. | Instalación real |
| C6 | **`aoi:handoffs` tiene un falso negativo**: no detecta que `sdd-ff` lee `bic.` (`sdd-ff.prompt.md:120`). Además, `sdd-new` y `sdd-apply` no consultan el BIC: la propuesta y la implementación se hacen sin mirar las Never Rules, que recién aparecen en Verify, donde corregir cuesta retrabajo. | `phase-handoffs.mjs` y `rg -c bic` |

## D. Flags: errores de tipeo silenciosos que cambian el comportamiento

| # | Hallazgo | Evidencia |
|---|---|---|
| D1 | **Un typo en `--audit` ejecuta la instalación, que escribe.** Afecta a `install-git-guard.mjs:197` y a `install-hooks.mjs:224`, que usan `argv.includes('--audit')`. Con `--audti`, el script escribe `.git/hooks/commit-msg` y sale con 0. | Ejecutado en una copia |
| D2 | **`invariant-gate.mjs:165` acepta cualquier flag.** Con un typo como `--exit-cod`, una auditoría FAILED sale con 0. Con `--bogus` sale 0. | Ejecutado |
| D3 | **`provider-setup.mjs --reset` más un `--set` mal escrito borra toda la asignación de modelos y aun así imprime ✅** (líneas 200–205 y 129). Además, `--show` le gana en silencio a `--set`. | Lectura de código |
| D4 | **`memory-sync/cli-args.mjs:36-46` acepta cualquier clave.** Si `--scopes` va mal escrito, el resultado vacío se interpreta como "todos los scopes" y se exporta todo. | Lectura de código |
| D5 | **La skill `memory-governance/SKILL.md:65` manda ejecutar `rollback-version.mjs`, que es una API y se niega a correr** (exit 1). Contradice `icm-protocol.instructions.md:149`. | Ejecutado |
| D6 | **Varios scripts aceptan flags o valores desconocidos sin quejarse** y caen a sus valores por defecto: `sanitize-subagent-payload` (`--format yaml` → markdown; `--task-dir` inexistente → exit 0), `link-resources`, `context-tombstone-cli` (`--treshold` → 0), `synthesize-stubs` y los lentes. En `compile-rules`, `--harness claud` sale 0 y compila 0 archivos. | Ejecutado |

## E. Instalación (setup.sh, ejecutado de punta a punta)

Resultado: exit 0 en ambos perfiles. `scaffold/` no queda en el destino, el guard de commit queda instalado y funciona, y el doctor da verde.

| # | Hallazgo |
|---|---|
| E1 | Si el nombre del workspace tiene un espacio, los topics compilados quedan sin comillas (`ws one-context`), y un `icm store -t` copiado tal cual parte el argumento en dos. |
| E2 | El CLAUDE.md instalado afirma cosas falsas: el espejo `scaffold/` y `test:parity`, que no existen en un workspace instalado, y "60/1356 .md" (en realidad son 1/235). En el repositorio de desarrollo, "unknown flags fall back silently" ya no es cierto para `compile-rules`, que sale con exit 2. |
| E3 | En los perfiles advanced/dashboard, la Fase 1.7 copia archivos antes del snapshot previo a la instalación y después avisa que "ya existían y NO se tocaron". |
| E4 | Detalles menores: la numeración de "Next steps" salta de 4 a 6, se dice "Run /init in Copilot Chat" con todos los harnesses seleccionados, y `/tmp/codebase-memory-mcp-index.log` usa una ruta fija. Sin verificar: `icm init --mode cli` sin `--per-project` probablemente no escribe `.windsurfrules`, y en ese caso esa limpieza es código muerto. |

## F. Lo que sí está bien (verificado)

- Las 1719 pruebas node y las 87 del dashboard pasan (las del dashboard, corridas a mano).
- La paridad entre la raíz y `scaffold/` se cumple: 432 archivos byte a byte.
- El doctor, la integridad de referencias, el cache-guard, el ledger de claims y la consistencia de importancia dan verde.
- Instalación: `scaffold/` se elimina del destino, el guard bloquea y deja pasar con `[aoi-managed-ok]`, y `provider-store --resolve` devuelve exit 3 cuando no hay asignación, como pide la preferencia del Owner.

## G. Prioridad sugerida de arreglo (en rama aparte)

1. **Hooks** (A1, A2, B1–B3). Hay que deduplicar contra el scope de usuario o dejar de correr `icm init --mode hook`; usar `rtk hook claude` al generar para Claude Code; mover el cierre a `SessionEnd` y borrar `icm hook stop`. Es el ahorro más grande y el arreglo más barato.
2. **Higiene de ICM** (A3, A4). Purgar `context-AOI` y los topics descartables (decisión del Owner), y aislar con `--db` toda corrida de `setup.sh` dentro de tests.
3. **Compuertas** (C1–C4). Arreglar el guard de `dashboard-command`; que `entry-points` lea `package.json` y corra su copia bajo una ruta con espacios; agregar `invariant-gate` y `blueprint-gate` a `pnpm test` o corregir CLAUDE.md; que el invariant gate rechace la evidencia que viene de tests con `skip`.
4. **Flags estrictos** (D1–D6). Una regla común: todo CLI rechaza los flags desconocidos con exit 2.
5. **Contexto** (A6–A10). Que CLAUDE.md recomiende los modos baratos de los lentes y `-E node_modules`; quitar `update-agent-context` de `speckit.plan`; sacar el bloque Headroom de los prompts que se compilan para Claude Code.

---

## Anexo — Resolución (2026-10-01)

Las secciones de arriba describen la versión auditada (`v2.5.2-164-g9d62242`) y no se tocaron. Este anexo registra en qué rama se resolvió cada hallazgo. La remediación la hizo el mismo modelo: un workflow de agentes en worktrees aislados (una rama por concern) con verificación adversarial independiente por rama, y después el merge a main de a una rama por vez, con `pnpm test` completo sobre un checkout limpio de main después de cada merge.

> **Un defecto del propio proceso, registrado porque es la misma clase de error que la auditoría caza.** El primer script del workflow trataba a un verificador que moría por límite de sesión (resultado `null`) como "sin bloqueantes". Así quedaron dos ramas reportadas como "clean" sin haber sido verificadas. Se detectó leyendo el journal y ambas se re-verificaron a mano: las dos tenían bloqueantes reales, que después se corrigieron.

### Estado por hallazgo

| Hallazgo | Estado | Rama / merge |
|---|---|---|
| A1, A2 (inyección duplicada de ICM) | Resuelto. El settings versionado es idéntico en toda máquina y la deduplicación ocurre al disparar el hook, contra el scope de usuario. | `fix/claude-hooks-wiring` · 36d2f64 |
| A3 (memoria ICM contaminada) | **Pendiente: decisión del Owner** (purgar es irreversible). Se agravó durante la remediación (ver N4). | — |
| A4 (setup y tests sobre el ICM real) | Resuelto: `AOI_ICM_DB` / `--icm-db` con un shim que agrega `--db` a toda llamada y bloquea `icm init` global. Verificado: 426 topics antes y después, y el hash de `~/.claude/settings.json` sin cambio. | `fix/icm-test-isolation` · 7bc90f6 |
| A5 (mcp-compressor ausente en Claude Code) | Pendiente. | — |
| A6, A7 (lentes, TOON y tombstone que nadie invoca) | **Pendiente: decisión del Owner** (cablearlos o revertirlos, según la regla de economía de tokens). | — |
| A8 (`speckit.plan` reescribe un compilado) | Resuelto; un test funciona de tripwire ante upgrades de spec-kit. | `perf/context-cost` · 82794d6 |
| A9 (CLAUDE.md apunta a salidas caras) | Resuelto, sin agrandar CLAUDE.md. | `perf/context-cost` · 82794d6 |
| A10 (costo por ciclo) | Parcial: CLAUDE.md instalado bajó de 9.664 B a 9.375 B. El resto (icm-protocol ×7, la cadena speckit en ff, el Headroom) sigue pendiente. | `perf/context-cost` |
| A11 (Engram en el CLAUDE.md global) | Fuera de AOI: lo decide el Owner. | — |
| B1, B2, B3 | Resueltos (dialecto `claude`, cierre en `SessionEnd`, `post-tool-learning` eliminado con prueba de equivalencia). | `fix/claude-hooks-wiring` · 36d2f64 |
| B4 (guard de commit ausente en el repo de desarrollo) | Pendiente; ver N5. | — |
| C1–C5, C6 (detector) | Resueltos. Además, PARTIAL ya no se lee como PASS en la prosa de verify, un skip incondicional ahora cuenta como no cubierto, y `blueprint-gate` distingue "icm roto" de "sin contrato". | `fix/silent-green-gates` · e49d868 |
| C6 (sdd-new y sdd-apply no consultan el BIC) | Pendiente (prosa de prompts). | — |
| D1 | Resuelto. | `fix/claude-hooks-wiring` |
| D2 | Resuelto. | `fix/silent-green-gates` |
| D3–D6 | Resueltos con un helper compartido de flags estrictos. Pendiente: `export/import-memory-bundle` todavía salen con 1 (no 2) ante un error de uso. | `fix/strict-cli-flags` · fb2c9f7 |
| E1, E2 | Resueltos. | `perf/context-cost` · 82794d6 |
| E3, E4 | Pendientes. | — |

### Hallazgos nuevos aparecidos durante la remediación

| # | Hallazgo | Estado |
|---|---|---|
| N1 | Los hooks de Claude usaban rutas relativas: medido sobre 107 transcripts, **41 disparos × 4 hooks fallaron con ENOENT** cuando el cwd no era la raíz, y RTK dejaba de reescribir sin avisar. | Resuelto en `fix/claude-hooks-wiring` |
| N2 | **El benchmark ocultaba pérdidas.** `token-accounting.mjs` ponía piso 0 al ahorro y `stress-suite.test.mjs` dependía del store ICM de quien lo corría. Con una base vacía, la Fase 0 dio 12 → 35 tokens, el reporte dijo "0.0%" y el total quedó inflado en 7 tokens. | Resuelto en `fix/stress-ledger-truth` · 85716fd |
| N2b | **Hallazgo de producto abierto.** El grounding O(1) de `/sdd-frame` sólo ahorra cuando el store ya tiene contenido. Para un usuario nuevo cuesta casi 3× el recall que reemplaza. El "91%" publicado para la Fase 0 depende del store del desarrollador, no del árbol. | Owner |
| N3 | **Los worktrees de Claude Code (`.claude/worktrees/`) rompen 3 compuertas.** Hay 13 recorredores del árbol con listas de directorios a saltear duplicadas, y ninguno reconoce un checkout anidado. | Resuelto en `fix/skip-nested-checkouts` · fe548c2. Un único módulo (`nested-checkout.mjs`) usado por 15 recorredores. Verificado: `pnpm test` sale con 0 desde la raíz real con 10 worktrees anidados. |
| N4 | **El extractor automático de `icm hook post` (global, upstream) guarda fragmentos de la salida de herramientas como memorias** ("Structured output provided successfully", números de línea sueltos). Observado en el recall durante esta sesión. | Owner / upstream ICM |
| N5 | `install-hooks.mjs` sin `--audit` falla dentro de un git worktree (`.git` es un archivo y el error es ENOTDIR en `installGitGuard`). | Pendiente |
| N6 | Contrapartes en Windows: `rtk-hook.ps1` y `icm-hook.ps1` siguen con dialecto copilot y sin deduplicación, y no está verificado el aislamiento de ICM en `setup.ps1`. | **Diferido** (no hay máquina Windows) |

### DCP (Dynamic Context Pruning): medido, no adoptado

Se midió sobre 107 transcripts reales de Claude Code de este repositorio (3.938 llamadas a herramientas):

- **Deduplicación de llamadas idénticas:** recortaría **0,0 %** (sólo hubo 4 repeticiones).
- **Purga de inputs fallidos:** ~8k tokens en total, unos 75 por sesión.
- **Compresión por LLM:** sólo existe para OpenCode, que no es un harness de AOI, y su propio README dice que invalida el prompt-cache.
- **`claude-dcp`:** reescribe `transcript.jsonl` en PreCompact y agrega 7 hooks, incluida una inyección más en UserPromptSubmit.

El desperdicio real estaba en la fuente, que es donde se aplicó la idea de DCP (deduplicar y podar en origen): la inyección duplicada de hooks (UserPromptSubmit ~67k tokens y SessionStart ~12k en 17 sesiones) y la memoria ICM obsoleta (A3 y N4).

### Ganancia medida (antes = main 9d62242 → después = main integrado)

| Medida | Antes | Después |
|---|---|---|
| Hook SessionStart, esta máquina | 4.755 B (3 handlers, 1 con salida inválida) | 1.599 B |
| Hook UserPromptSubmit, **por mensaje** | 4.530 B | 2.265 B |
| Hook Stop, por turno | 35.383 B (salida inválida) | 0 B |
| Clon limpio, sin ICM global | SessionStart 3.176 B, con fallas fuera de la raíz | 1.599 B, sin fallas |
| CLAUDE.md instalado (siempre cargado) | 9.664 B | 9.375 B |
| Adaptador CLAUDE.md según `aoi:cache-prefix` | 2.397 tok | 2.326 tok |
| Banda universal según `aoi:cache-prefix` | 7.277 tok/fase | 7.277 tok/fase (no se tocó) |
| Tests que la cadena ejecuta de verdad | sin los 87 del dashboard | +87 tests del dashboard; el entry-point probe pasa de 23 a 51 rutas |

`aoi:stress-sdd` pasó de 72,8 % a 75,7 %. **Esa diferencia no se atribuye a esta remediación:** ese benchmark mide los payloads de las fases SDD, que no se modificaron, y su delta viene del corpus de la Fase 1 y de la disponibilidad de la Fase 0 en el entorno de medición.

La confirmación en vivo vino de esta misma sesión: después del merge de `fix/claude-hooks-wiring`, el recall de UserPromptSubmit llegó una sola vez por mensaje, cuando antes llegaba duplicado.
