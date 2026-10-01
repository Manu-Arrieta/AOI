# Propuesta — Optimización de tokens sobre el contexto acumulado

- **Estado:** propuesta para evaluar. No autoriza implementar nada.
- **Base medida:** main `1b1c574` (después de la remediación del 2026-10-01).
- **Modelo:** Claude Opus 5.5 (contexto 1M), `claude-opus-5-5[1m]`, vía Claude Code.
- **Fuente de los datos:** 377 transcripts reales de Claude Code de este repositorio: 110 sesiones principales y 258 de subagentes, con 7.861 requests en total. Los analizadores son deterministas (`token-profile.mjs`, `bash-profile.mjs`, `prefix-profile.mjs`, `hook-measure.mjs`) y se pueden volver a correr para medir el "después".

## 1. El diagnóstico que cambia la estrategia

| Medida | Valor |
|---|---|
| Input servido desde el prompt-cache | **98,1 %** (1.745M tokens leídos de caché, 34M escritos, 3,8M de salida) |
| Contexto releído por request, sesión principal | **359k tokens** |
| Contexto releído por request, subagente | **86k tokens** |
| La sesión más cara | **1.101M tokens** releídos en 2.386 requests, con un pico de 966k: **76 %** de todas las sesiones principales |
| Parte del contexto releído que es prefijo fijo (CLAUDE.md, instrucciones, skills) | **13,6 %** |
| Parte que es conversación acumulada (salidas de herramientas, inyecciones de hooks) | **86,4 %** |
| Líneas del recall de UserPromptSubmit repetidas dentro de la misma sesión | **82,2 %** (527 KB de 634 KB) |

**Consecuencia.** Hasta ahora AOI optimizó el prefijo (CLAUDE.md, `applyTo`, bandas de skills, cache-prefix). Ese frente cubre como mucho el 13,6 % del consumo real, y la caché ya acierta el 98 %, así que seguir afinándolo rinde poco. El costo real es **cuántas veces se relee lo que se acumula**: todo lo que entra a la conversación se paga una vez por cada request posterior. Las propuestas que siguen atacan eso y están ordenadas por palanca medida.

## 2. Propuestas

### P1 — Una fase SDD es un límite de contexto *(la mayor palanca)*

**Qué:** cada `/sdd-*` corre en un contexto nuevo, ya sea un subagente o una sesión nueva. La fase arranca sólo con su contrato de entrada, que `aoi:handoffs` ya define y verifica (proposal, spec, design, tasks y los facts `bic.*`/`sbc.*`), ensamblado por `assemble-phase-context.mjs`. Ese lente hoy no lo usa nadie (A6), y con esto pasaría a tener un consumidor real.

**Por qué:** un request de subagente relee 86k tokens y uno de la sesión principal 359k. La sesión de 1.101M tokens fue un ciclo largo hecho entero en un solo contexto.

**Complemento determinista:** un medidor de contexto en un hook que lee el `usage` del transcript (`transcript_path`). Al pasar un umbral (por ejemplo 200k) inyecta **una línea**: "hacé checkpoint en ICM y pasá a la siguiente fase en un contexto nuevo". Cuesta 0 tokens hasta que dispara.

**Guarda de calidad:** la continuidad no depende de la memoria del chat, sino de artefactos que ya están contratados y auditados por compuerta (`aoi:handoffs`, `aoi:invariant-gate`). Para probar equivalencia, `aoi:probes` antes y después, más un ciclo SDD real comparando los `verify-report.md`.

**Ganancia esperada (a medir):** si los requests de la sesión principal bajaran de 359k a ~150k de promedio, el contexto releído de las sesiones principales caería ~58 %.

### P2 — Deduplicar el recall dentro de la sesión *(DCP aplicado en la fuente)*

**Qué:** `icm-hook.sh`, que ahora controla AOI, guarda por sesión los ids o hashes de las líneas que ya inyectó (`/tmp/aoi-recall-seen.<session_id>`) y no las repite. `PreCompact` y `SessionStart` vacían ese registro, porque después de compactar la línea ya no está en el contexto y vuelve a valer la pena. Además, no hay recall para prompts de pura continuación ("continua", "procede"; 55 medidos).

**Guarda de calidad:** la pérdida de información es nula por construcción: sólo se omite lo que ya está en el contexto.

**Ganancia medida:** −82,2 % de las líneas de recall (527 KB de 634 KB) en el historial, y cada una de ellas se releía en todos los requests posteriores.

**Condición:** en esta máquina el que inyecta es el hook global de ICM (`~/.claude/settings.json`), y el de AOI se calla para no duplicar. Para que el filtro aplique, el Owner tiene que decidir uno de dos caminos: quitar el `prompt` global y dejar a AOI como único inyector, o pedirle la deduplicación a ICM upstream.

### P3 — Acotar las salidas de herramientas en el origen

**Qué:** en las sesiones medidas, las lecturas completas de archivo fueron lo más caro: `bat` volcó ~3,4 MB (con 5–6 KB de promedio por llamada), `git diff` 697 KB, `sed -n` 656 KB, `Read` sin `limit` 3,1 MB (45 lecturas de más de 20 KB) y una imagen PNG de 557 KB. Se propone un `PreToolUse` determinista que, ante la lectura completa de un archivo de más de N KB sin rango (o un `git diff` sin `--stat` previo), responda "deny" con un motivo: usar `aoi:ast-lens`, un rango, o `--stat` primero. El modelo reintenta por la vía barata. Las imágenes grandes se reducen antes de verlas.

**Guarda de calidad:** es un badén, no una pared. Todo sigue siendo accesible por rango, y hay una vía explícita de override para cuando la lectura completa sí hace falta.

**Ganancia esperada:** sobre ~9 MB de salidas medidas, el recorte depende de N; se mide con el mismo analizador después de una semana de uso. Complementa con `rtk discover`, que encuentra los comandos frecuentes que RTK todavía no comprime (`bat` entre ellos).

### P4 — Apagar el extractor de `icm hook post` y medir la higiene

**Qué:** el extractor automático guardó en dos días 84 fragmentos de salida de herramientas como memorias ("Structured output provided successfully", comentarios de código, líneas de `node --test`). Esos fragmentos después vuelven inyectados por el recall. Se propone que el wrapper de AOI no reenvíe el modo `post` a la extracción, y conservar los stores del protocolo (curados) y la extracción de `end`/`compact`.

Además, una compuerta de 0 tokens, `aoi:icm-hygiene` (el clasificador usado en la purga del 2026-10-01), en el doctor: informa memorias basura y memorias que citan rutas que ya no existen.

**Guarda de calidad:** antes de apagarlo, medir sobre una muestra qué proporción de lo extraído es útil. Si hay útil, filtrar en vez de apagar.

### P5 — El prefijo fijo, multiplicado por requests

Vale el 13,6 %, pero cada byte se paga en cada request (4.045 en las sesiones principales).

- Bloque Engram del CLAUDE.md global: **3.651 B** de instrucciones para herramientas (`mem_save`, …) que no están en la sesión. Es configuración del Owner, fuera de AOI.
- El protocolo ICM aparece 3 veces en Claude Code: CLAUDE.md global (1.612 B), CLAUDE.md del proyecto e instrucciones del servidor MCP. Se propone una sola fuente.
- En Copilot, `icm-protocol.instructions.md` (`applyTo: **`) entra en las 7 fases (14,9k tok por ciclo). Hay que respetar que las superficies de cada harness son disjuntas (Antigravity no lee `.github/instructions/`), así que se recorta por dialecto y no se borra.

### P6 — Correcciones chicas con ganancia medida

- **Fase 0 con store vacío:** el grounding cuesta 35 tokens frente a 12 del recall. Saltear el probe cuando no hay facts (es un usuario nuevo).
- **`sdd-ff`:** `extensions.yml` se lee 4 veces (4.184 B c/u) y la constitución 3 veces por ciclo. Pasar a facts O(1) lo que se consulta.
- **TOON y tombstone:** cablearlos donde hay payload real (delegación a subagentes con P1) y medir. Si no ahorran, revertirlos, según la regla de economía de tokens.

## 3. Lo que esta propuesta desaconseja

- **Más trabajo sobre cache-prefix:** la caché ya acierta el 98,1 %.
- **Instalar DCP:** se midió 0,0 % de deduplicación de tool calls y la compresión invalida la caché (ver la auditoría del 2026-09-30).
- **Recortar instrucciones sin prueba de equivalencia:** la mayor parte del costo no está ahí.

## 4. Cómo se mide el después

Re-correr los cuatro analizadores sobre las sesiones posteriores al cambio y comparar:

1. contexto releído por request (principal y subagente);
2. reparto entre prefijo y crecimiento;
3. porcentaje de recall repetido;
4. bytes de salida por herramienta.

En paralelo, `aoi:probes` y un ciclo SDD real: la calidad se compara en los `verify-report.md`, no en el chat.

---

## Estado (2026-10-01): implementado por decisión del Owner ("procede")

El Owner pidió además que todo funcione igual para los providers declarados: 11 endpoints custom de Copilot (GLM, DeepSeek, Qwen, Kimi y MiniMax, vía Nvidia, Alibaba, Zai y los propios fabricantes). Cada rama pasó por verificación adversarial independiente antes del merge.

| Propuesta | Merge | Resultado medido | Limitación conocida |
|---|---|---|---|
| P1: medidor de contexto | 4d46fea | **Exacto por provider.** En Copilot lee `inputTokens` y `model` del debug log de Copilot (lo que reporta el propio provider) y `max_prompt_tokens`. En Claude Code lee el `usage` del transcript. El umbral es mín(50 % de la ventana, 200k), y la ventana sale del `maxInputTokens` declarado, con 128k si no hay (los 11 modelos declarados verificados). Replay: Copilot pasa de 529 avisos falsos a 148 en 91 de 195 sesiones, todos con conteo exacto y ninguno por encima de la ventana; Claude, 19 en 8 sesiones. Avisa como mucho 3 veces por sesión. Latencia: 0,06–0,10 s por prompt. | En Copilot el aviso llega al usuario (`systemMessage`) y no al modelo. Las versiones de Copilot anteriores a 0.48 no tienen debug log: ahí el medidor calla. Sólo dispara en un prompt, no a mitad de un turno largo. |
| P2: recall una vez por sesión | 71523f3 | −59,6 % de bytes de recall en el replay de 197 prompts reales; +7 ms por prompt. Se reinicia en PreCompact, en startup y a los 40 prompts (rewind). Si falla, inyecta igual que antes. | **Sólo aplica donde el wrapper de AOI es el que inyecta.** Si `setup.sh` corrió `icm init --mode hook` (como en esta máquina), el hook global de usuario inyecta y AOI se hace a un lado. |
| P4: extractor | 71523f3 | **No se apagó.** Medición previa: ~45 % útil en la cola procesada por LLM (IC95 ≈ 32–63 %) y ~15 % en la extracción por reglas. El doctor suma `ICM Memory Hygiene` (0 tokens): hoy marca 5 memorias basura y 14 que citan rutas inexistentes. | Hace falta filtrar el modo `post` (propuesto, no hecho). |
| P3, P5, P6 | — | Pendientes. | — |

**Defectos de ICM encontrados durante la implementación (upstream):**
- `icm hook end` y `compact` lanzan un worker LLM que ignora `--db`.
- `icm hook prompt` ignora `[recall] enabled` y `limit`.
- `ICM_CONFIG` sí respeta `[extraction] enabled`.
- El `env` del proyecto en Claude Code llega a los hooks de scope de usuario (medido con `claude -p`).
