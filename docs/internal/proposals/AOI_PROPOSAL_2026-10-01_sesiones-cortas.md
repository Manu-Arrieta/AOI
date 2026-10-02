# Propuesta: sesiones cortas, sesión principal como orquestador, e instrumento de tokens

- **Estado:** propuesta para evaluar. No autoriza implementar nada. El Owner pidió dejarla planteada para retomarla en una **sesión nueva**.
- **Base:** main `v2.5.2` + remediación del 2026-10-01 (último merge: `feat/aoi-owns-icm-hooks`).
- **Modelo:** Claude Opus 5.5 (contexto 1M), `claude-opus-5-5[1m]`, vía Claude Code.
- **Antecedentes:** [AOI_PROPOSAL_2026-10-01_contexto-acumulado.md](AOI_PROPOSAL_2026-10-01_contexto-acumulado.md), donde están las mediciones y las propuestas P1, P2 y P4 ya implementadas.

## 1. Por qué estas tres y en este orden

Medido sobre 377 transcripts reales de Claude Code (110 sesiones principales y 258 de subagentes, 7.861 requests), más 225 transcripts de Copilot:

| Hecho | Valor | Consecuencia |
|---|---|---|
| Parte del contexto releído que es conversación acumulada | **86,4 %** | Importa más el largo de la sesión que el tamaño del prefijo. |
| Contexto que relee cada request: sesión principal / subagente | **359k / 86k** | Delegar sale unas 4 veces más barato por request. |
| La sesión más cara | 1.101M tokens, el **76 %** del total | Los ciclos largos en un solo contexto son el costo dominante. |
| Prompt-cache | 98,1 % de aciertos | Afinar la caché ya no rinde. |
| Replay del medidor P1 cortando donde avisa | −71,4 % de contexto releído (estimado, con 20k de costo por traspaso) | Avisar está implementado; **hacer cumplir el corte, no**. |

El costo de una sesión crece aproximadamente con *requests × contexto medio*, y el contexto medio crece con los requests. Duplicar el largo de una sesión cuesta cerca de 4 veces más. Por eso el orden es: **primero** acortar las sesiones (S1), **después** que la sesión principal no acumule (S2), y **siempre** medir (S3).

## 2. Las tres piezas

### S1. Una fase, una sesión (hacer cumplir el límite de contexto)

**Hoy:** el medidor (`scripts/sdd-lifecycle/context-meter.mjs`, que dispara en UserPromptSubmit) avisa al pasar el umbral, y cada `sdd-*.prompt.md` cierra con una línea que sugiere seguir en un contexto nuevo. Sugerir no alcanza: en esta misma sesión el aviso disparó a 479k y el trabajo siguió.

**Propuesta:**
1. Al empezar, cada `/sdd-*` lee el estado del medidor de la sesión (archivo de estado por `session_id`). Si el contexto supera el umbral, la fase **no arranca**: imprime el checkpoint que falta (`icm store` de la fase anterior, más `pnpm aoi:registry`) y pide abrir una sesión nueva con el comando de la fase siguiente. Esto lo decide un script determinista, `aoi:phase-gate`, que la prosa sólo invoca. No se agrega razonamiento a la prosa.
2. Override explícito para el Owner, por ejemplo `--force-same-session`, que queda registrado en `registry.md` para que se pueda auditar.
3. Al cerrar una fase, `/sdd-*` deja impreso el comando exacto para retomarla (`/sdd-<siguiente> <TASK-ID>`).

**Guarda de calidad:** la continuidad viaja en artefactos que ya están contratados y verificados por compuerta: `aoi:handoffs` (las entradas de cada fase), `aoi:invariant-gate` (BIC) y los facts O(1) en ICM. La prueba de equivalencia es correr un ciclo SDD real dos veces, en una sola sesión y en sesiones por fase, y comparar `verify-report.md` y `aoi:probes`.

**Providers:** el umbral ya es mín(50 % de la ventana del modelo, 200k), con ventanas exactas por provider (debug log de Copilot y `usage` de Claude). En Copilot, el aviso del hook llega al usuario y no al modelo, así que **la compuerta tiene que ejecutarla el prompt** mismo para que corte en los dos harnesses.

**Aceptación:** con la compuerta activa, ninguna fase arranca por encima del umbral sin override registrado. En el replay de S3, el contexto releído por ciclo SDD baja al menos 50 % sin que empeoren los veredictos.

### S2. La sesión principal sólo orquesta

**Regla:** la sesión principal nunca lee un archivo de más de N KB completo, nunca ve un log de tests ni un diff entero, y no explora. Delega en subagentes que devuelven **conclusiones con esquema fijo** (hallazgos, evidencia `archivo:línea`, veredicto), no volcados.

**Mecanismo (determinista):**
1. Un hook `PreToolUse` sólo para la sesión principal (en Claude Code, los eventos de subagentes llevan otro `agent_id`; hay que verificarlo) que rechaza, con un motivo que sugiere la vía barata:
   - lecturas completas de más de N KB (`Read` sin `limit`, `bat` o `cat` sin rango) → `aoi:ast-lens`, un rango o delegar;
   - `git diff` sin `--stat` previo;
   - `pnpm test` sin redirección a archivo → `pnpm test > log` y luego el resumen con `diagnostic-distiller`.
   Es un badén, no una pared: hay override explícito.
2. En la prosa de `supervisor.agent.md` y de los prompts: la exploración y la verificación se delegan, y el resultado vuelve con un esquema acotado (máximo de palabras).

**Guarda de calidad:** nada queda inaccesible, porque el rango y la delegación siguen disponibles. La equivalencia se prueba con los mismos `aoi:probes` y la comparación del ciclo real de S1.

**Providers:** el hook es de harness y no depende del modelo. En Copilot, `PreToolUse` puede devolver "deny" con un motivo (según la documentación de VS Code), pero **hay que verificarlo en Copilot** antes de dar la paridad por hecha.

**Aceptación:** en el replay de S3, los bytes de salidas de herramientas en la sesión principal caen al menos 60 % (hoy ~9 MB entre `bat`, `git diff`, `sed` y `Read`), y el contexto medio por request de la sesión principal se acerca al de los subagentes.

### S3. El instrumento: `pnpm aoi:token-profile`

**Qué:** convertir en un comando del repositorio los analizadores que se usaron para todas las cifras de este documento y del anterior (los prototipos están en [`token-profile-prototypes/`](token-profile-prototypes/); leen rutas de esta máquina y hay que parametrizarlos):

- `token-profile.mjs`: prompt-cache, `Read`, Bash, recall.
- `bash-profile.mjs`: salida por comando real y costo por sesión.
- `prefix-profile.mjs`: reparto prefijo/crecimiento y recall repetido.
- `hook-measure.mjs`: inyección de hooks por evento.
- `context-meter-replay.mjs`: dónde habría cortado el medidor.

Lee los transcripts de Claude Code (`~/.claude/projects/<repo>/`) y los debug logs de Copilot (`workspaceStorage/*/GitHub.copilot-chat/debug-logs/`), **siempre en solo-lectura**: extrae números y nunca copia contenido. Produce una tabla que se puede comparar entre corridas y guarda la última línea base en `docs/internal/` con fecha y `git describe`.

**Por qué va primero aunque esté último:** la regla del Owner exige medir la ganancia antes y después de cada cambio de tokens. Sin el instrumento en el repositorio, cada medición se reescribe a mano en cada sesión, y eso es justamente el tipo de costo que se quiere eliminar.

**Aceptación:** el comando reproduce las cifras de la sección 1 (±1 %) sobre los mismos transcripts. Tiene tests con fixtures sintéticos (sólo forma, nunca contenido real) y queda espejado en `scaffold/`.

## 3. Orden de implementación sugerido

1. **S3** primero, porque es la línea base contra la que se mide todo lo demás.
2. **S1**, la palanca mayor. Se mide con S3.
3. **S2**, que se mide con S3 y se verifica en Copilot antes de declarar paridad.

Cada pieza va en su propia rama, con verificación adversarial independiente y merge de a una, siguiendo el método de la remediación del 2026-10-01. Ojo: un verificador que muere no cuenta como "limpio".

## 4. Punto de partida para la sesión nueva

- **Leer:** este documento; la tabla "Estado" de `AOI_PROPOSAL_2026-10-01_contexto-acumulado.md`; el anexo de `docs/internal/audits/AOI_AUDIT_2026-09-30_*`.
- **Recall:** `icm recall "contexto acumulado sesiones cortas medidor"` y `icm list --topic AOI-decisions`.
- **Gotchas ya medidos:**
  - `icm hook end` y `icm hook compact` lanzan un worker que ignora `--db`: no correrlos en pruebas.
  - `ICM_DB` no aísla; `--db` y `AOI_ICM_DB` sí.
  - En Copilot, UserPromptSubmit no entrega contexto al modelo.
  - Copilot CLI no cargó `.github/hooks` desde una carpeta no confiable.
- **Pendientes heredados:**
  - P3 (salidas de herramientas, que se solapa con S2), P5 (prefijo) y P6 (menores).
  - `setup.ps1` (Windows, diferido).
  - Filtrado del modo `post` del extractor.
  - Fase 0 con store vacío (12 → 35 tokens).
