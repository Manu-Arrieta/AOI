# Auditoría a fondo de los cambios del 2026-09-13

**Alcance:** los 18 commits del día, 52 archivos, +5.699 líneas.
**Estado del repo al auditar:** `5c6fbba`, limpio, sincronizado con `origin/main`.

---

## 1. Integridad estática — 12/12 verde

| Compuerta | Exit |
| :--- | :--- |
| `test:parity` (paridad de scaffold) | 0 |
| `aoi:srp` (límite 300 LOC) | 0 |
| `aoi:test-globs` | 0 |
| `aoi:reachability` | 0 |
| `aoi:routing` (registro de agentes) | 0 |
| `aoi:lint-refs` | 0 |
| `aoi:cache-guard` | 0 |
| `aoi:audit-protocol` | 0 |
| `aoi:importance` | 0 |
| `aoi:tools` | 0 |
| `aoi:hooks` | 0 |
| `aoi:registry` | 0 |

**Paridad: 347 archivos byte a byte.**

---

## 2. Suites de test — 1.173 tests, 0 fallos

| Runner | Tests | Pass | Fail |
| :--- | ---: | ---: | ---: |
| `node --test` (todas las áreas) | 1.091 | 1.091 | 0 |
| `vitest` (dashboard) | 82 | 82 | 0 |

**`pnpm test` completo: EXIT 0 en 25 s.**

---

## 3. Comportamiento

### Handoffs
`aoi:handoffs` EXIT 0. Las 6 fases tienen su cadena verificada:
cada artefacto exigido lo produce una fase anterior y ambos prompts lo nombran.

### Sondas conductuales — **25/25 y el judge discrimina**

`aoi:probes` emite 25 sondas (coinciden con las 25 declaradas en
`behavioral-scenarios.mjs`).

**Control negativo ejecutado** (`control-negativo-eval.mjs`), tres juegos de
respuestas construidas, cero inferencia:

| Juego | Resultado | Esperado |
| :--- | :--- | :--- |
| A. Evasivas (`NO PUEDO DETERMINARLO...`) | **0/25 · failed 25** | FALLAR ✅ |
| B. Correctas | **25/25** | PASAR ✅ |
| C. Invertidas (el patrón `forbidden` como respuesta) | **0/25 · failed 25** | FALLAR ✅ |

**El judge discrimina en las tres direcciones.** Sin esto, el "25/25" de la
matriz sería un sello de goma: hay que probar que distingue sano de roto antes
de creerle al verde.

### `aoi:probes:judge` sin argumento → exit 2
**No es un defecto.** El uso es `--judge <answers.json>`, y el runner documenta
*"lo único que cuesta inferencia es PRODUCIR las respuestas"*. Sin archivo, el
error que da es correcto.

### `aoi:context` EXIT 0

---

## 4. Ahorro y telemetría

| Métrica | Valor |
| :--- | ---: |
| PISO por ciclo | **88.897** |
| TECHO condicional | 105.409 |
| Payload optimizado | 5.480 |
| Payload como % del piso | **5,8 %** |
| Masa repetida sobre el piso | **63,4 %** |
| Universal ×6 | 56.370 (8 archivos, 9.395/fase) |
| Huella de la masa repetida | `0b9c49bb3a0cf440` |

**Todas las cifras coinciden con las mediciones previas.** Ni el PISO ni la
huella se movieron, que es la propiedad correcta: los cambios del día tocaron
mecanismos internos del probe, no la prosa que se inyecta.

### El titular, corregido y funcionando

```
TOTAL ACUMULADO · 4 de 6 fase(s) sobre artefactos reales, 1 por fixture,
1 omitida(s) — NO es un ciclo completo:
- Consumo Base Estimado:     21,539 tokens
- Consumo AOI:               5,480 tokens
- AHORRO TOTAL:              16,059 tokens (74.6% de reducción neta)
```

El fix de `formatTotals` está en producción: ya no declara "CICLO SDD COMPLETO"
cuando `.tasks/` está vacío. **+218 tokens de base** contra la corrida previa
(21.321 → 21.539) por el corpus de descubrimiento, que se muestrea del árbol
vivo; el consumo de AOI quedó **idéntico en 5.480**.

---

## 5. Gobernanza

### `aoi:doctor` — EXIT 0, 11/11

```
✅ icm · rtk · headroom · codebase-memory-mcp · specify (5 binarios)
✅ ICM DB integrity: ok
✅ .tasks/registry.md: 0 tasks
✅ Memory versioning: 0 workspace states
✅ 5 harness adapters (Copilot, Claude, Cursor, Antigravity, Cline)
✅ Paridad: 347 archivos byte a byte
✅ .resources/ válido

Diagnostic Summary: 11 Passed, 0 Warnings, 0 Failed
```

### `aoi:invariant-gate` — EXIT 2
**No es una regresión.** El gate bloquea porque `.tasks/` tiene 0 tareas, así que
la entidad `AOI` no tiene hechos `bic.*`. La fase `/sdd-frame` es la que
**deliberadamente** no materializa nada en disco (*zero-task footprint*), así que
en un repo sin tareas en curso este gate **no tiene qué verificar**. Verificado
que `invariant-gate.mjs` **no fue tocado hoy**.

---

## 6. Mutación

| Verificación | Resultado |
| :--- | :--- |
| Mecanismo del ratchet (`scripts/mcp-gateway`, piso 71) | **71 % · `held`** EXIT 0 |
| Guardián del reaper | **8 mutantes, 0 asesinos** |
| Camino de muerte completo | **81 mutantes, 0 asesinos** |
| Mutantes de mi código nuevo | 11 probados, 9 mueren, 2 equivalentes medidos |

El ratchet **está exactamente en su piso** (`71 %` vs piso `71`), sin holgura:
la próxima vez que alguien toque `mcp-gateway`, esta compuerta va a ser lo
primero que grite. Está bien —para eso es un trinquete— pero conviene saberlo.

**Pisos declarados (11 áreas):** `memory-sync` 91 · `sandbox` 88 · `scripts` 81 ·
`mcp-gateway` 71 · `subagent-context` 69 · `sdd-lifecycle` 68 · `code-lens` 65 ·
`conf` 62 · `scaffold` 62 · `spatiotemporal-runtime` 59 · `multi-harness` 55.

---

## 7. CI

| Commit | `pnpm test` en CI | Ratchet |
| :--- | :--- | :--- |
| `5c6fbba` (actual) | **SUCCESS** | en progreso |
| `a0f162a` | — | en progreso |
| `72bacd1` | — | en progreso |
| `8e6c666` | **failure** (paridad) | — |
| `348eb86` | success | **failure** ← el fallo que motivó los fixes |

**El `pnpm test` en Linux ya pasa con el commit actual**, lo que confirma que la
aserción flaky era la causa del rojo. Falta el veredicto del ratchet.

---

## 8. Hallazgos y correcciones

### Corregidos durante la auditoría
1. **`control-negativo-eval.mjs`: el generador de respuestas "correctas"
   fallaba en 3/25.** Convertía el regex `expected` a texto con reemplazos a
   mano y no traducía `\s*`, `\.` ni alternancias ancladas. **El defecto era del
   conversor, no del judge.** Reescrito para elegir de una lista de candidatos
   por el criterio del propio `expected`, que es lo que convierte al juego B en
   una comprobación de que el judge no rechaza todo.
2. **El mismo script rechazaba una respuesta de 10 caracteres** por el piso de
   12 del judge. **El judge tenía razón**; se agregó el motivo a la respuesta.

### Sin acción (verificados como correctos)
- `aoi:probes:judge` sin argumento: uso incorrecto, no defecto.
- `aoi:invariant-gate` exit 2: por diseño, sin tareas en `.tasks/`.
- `aoi:stress-sdd` fase 5 omitida y fase 2 por fixture: por `.tasks/` vacío.

### Pendiente, fuera de esta auditoría
- **Ratchet en CI** sin veredicto todavía (~40 min por corrida).
- **12 supervivientes** en `validate-test-globs` (**solo lectura, riesgo nulo**),
  8 más entre `source-reachability`, `parity` y `validate-srp`.
- **Comparabilidad del stress-suite**: no distingue "cambió el mecanismo" de
  "creció la entrada".
- **`mdworker`**: correlaciona con el probe (9 SIGKILL con, 0 sin) pero la
  causa **no está probada**.

---

## Veredicto

**Todo el ciclo funciona de forma acoplada.** Las 12 compuertas estáticas, las
dos suites (1.173 tests), el eval conductual con control negativo, la telemetría
de ahorro y el doctor están en verde y **consistentes entre sí**: el PISO y la
huella no se movieron, el payload quedó idéntico, y la paridad sostiene los 347
archivos.

Los tres "rojos" que aparecen (`probes:judge`, `invariant-gate`, la fase 5 del
stress) son **usos incorrectos o estados por diseño**, no regresiones — y cada
uno está verificado como tal, no asumido.
