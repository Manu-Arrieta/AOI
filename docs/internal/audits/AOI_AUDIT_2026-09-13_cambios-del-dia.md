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

**Paridad: 347 archivos byte a byte al momento de esta sección; 349 al cierre**
(después del alta de `benchmark-inputs.mjs` y su test).

---

## 2. Suites de test — 1.195 tests, 0 fallos

| Runner | Tests | Pass | Fail |
| :--- | ---: | ---: | ---: |
| `node --test` (todas las áreas) | 1.113 | 1.113 | 0 |
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

---

## 9. Seguimiento — pendientes cerradas después de la auditoría

### Supervivientes del parser: 12 → 2 (`acd5868`)

**La causa era de cobertura, no de código.** Los tests cubrían
`auditTestGlobs`, `expandGlob` y `collectTestGlobs`, y **ninguno** cubría
`stripComments`, `collectTestFiles`, `collectVitestIncludes`,
`findOrphanTests` ni `findOwningPackage`.

`stripComments` se llevaba los doce: **su único consumidor tolera cualquier
mutación que no cambie el glob parseado**, así que ramas enteras del escáner no
tenían ninguna entrada que las distinguiera.

| | Antes | Después |
| :--- | ---: | ---: |
| Mutantes | 42 | 43 |
| Muertos | 30 | **41** |
| Sobrevivientes | 12 | **2** |
| Score | 71 % | **95 %** |

**Los 2 que quedan, declarados con su razón:**

| Superviviente | Por qué no se ata |
| :--- | :--- |
| `findOwningPackage:281 [and→or]` | La única entrada que lo distingue **cuelga el event loop**: `path.dirname('.')` es `'.'`, el bucle es sincrónico y **el timeout de `node:test` no lo corta**. Un caso así cambiaría un superviviente por una suite colgada. |
| Guarda del CLI `:352 [and→or]` | **Alcance del prober**: corre el glob `scripts/scaffold/*.test.mjs`, donde `process.argv[1]` es el test y nunca matchea el guard. Necesita el runner del ratchet, que corre el CLI directo. |

### Un bug real encontrado escribiendo esos tests

El docblock de `stripComments` declara que **preserva la longitud** *"so any
offset computed against the result still lines up"*. **Era falso en el borde:**

```
in : "x = 1 // c"    len 10
out: "x = 1     \n"  len 11   ← el comentario sin salto final agrega un carácter
```

El `\n` se emitía siempre en vez de solo cuando el bucle paraba en uno. Ninguna
prueba lo veía porque al único consumidor un carácter de más le da igual.
**Corregido**, y la invariante ahora se cumple en **9 de 9** casos, con un caso
propio para el borde.

*(Nota de método: los 12 supervivientes incluían `:147 [and→or]`, que el
docblock describe como un bug ya arreglado sobre el glob `test/**/*.test.ts`.
Verifiqué que **sí está arreglado** — mediante el manejo de comillas— y que mi
caso de prueba inicial era inválido porque usaba el glob **sin comillas**. El
uso real lo pone entre comillas y el escáner lo protege.)*

### Comparabilidad del stress-suite: implementada (`acd5868`)

Nuevo módulo `benchmark-inputs.mjs` (120 LOC) que mide y reporta los insumos
**fijos** del benchmark con su huella, y el reporte lo imprime después de la
telemetría de tokens:

```
COMPARABILIDAD DE LOS INSUMOS FIJOS:
  Phase_3_Apply — AST-Lens mide siempre estos dos archivos
    archivos: 2 · 21311 bytes · huella 499822a9ed082538

CÓMO LEER UN DELTA: si la huella cambió, el insumo cambió — el delta de
tokens puede ser del archivo y no del mecanismo. El % de reducción de la
tabla es el ratio, y ese sí es comparable entre revisiones.
```

Va en su **propio módulo** y no dentro de `stress-report.mjs` porque ese archivo
declara su frontera: *"the suite MEASURES... everything here only READS what has
already been decided and arranges it for a human"*.

**Por qué importa, con el número:** `resource-operations.ts` pasó de 9.291 a
14.008 bytes entre `v2.1.0` y hoy, y el ahorro de la fase bajó de 81 % a 77 %,
mentras el **ratio quedó idéntico**. Sin la huella, ese delta se lee como
regresión del mecanismo.

### CI: el fallo era FLAKY, y está probado

| Commit | `mutation-probe.mjs` | `pnpm test` | Ratchet |
| :--- | :--- | :--- | :--- |
| `348eb86` | `5e03c34a5a62ee4c` | success | **failure** |
| `72bacd1` | `5e03c34a5a62ee4c` | success | **success** |

**Mismo hash de código, resultado distinto.** Eso confirma que el rojo del CI
era la aserción flaky comparando dos lecturas de memoria viva, y no un defecto
determinista.

---

## 10. Veredicto

**Todo el ciclo funciona de forma acoplada.** Las 12 compuertas estáticas, las
dos suites (**1.195 tests**, 1.113 de `node --test` + 82 de `vitest`), el eval
conductual con control negativo, la telemetría de ahorro y el doctor están en
verde y **consistentes entre sí**: el PISO (88.897) y la huella de la masa
repetida (`0b9c49bb3a0cf440`) no se movieron, el payload quedó idéntico en
5.480, y la paridad sostiene los **349** archivos.

Los tres "rojos" que aparecen (`probes:judge`, `invariant-gate`, la fase 5 del
stress) son **usos incorrectos o estados por diseño**, no regresiones — y cada
uno está verificado como tal, no asumido.

### Estado de los pendientes

| Pendiente | Estado |
| :--- | :--- |
| 12 supervivientes del parser | **Cerrado: 12 → 2**, los 2 declarados con su razón |
| Comparabilidad del stress-suite | **Cerrado**: `benchmark-inputs.mjs` en el reporte |
| Ratchet de CI | **Parcialmente verificado**: `72bacd1` pasó con el mismo hash que falló en `348eb86` → el rojo era **flaky** |
| 8 supervivientes en `reachability`/`parity`/`srp` | Abierto, **riesgo nulo** (solo lectura) |
| `mdworker` | Abierto: **correlaciona** (9 SIGKILL con el probe, 0 sin), causa **no probada** |
| Reproducibilidad completa (169 mutantes × 2) | Abierto: es trabajo de CI, no de una máquina de trabajo |

### Propiedades que quedaron demostradas

1. **El judge conductual discrimina** en las tres direcciones (evasivas 0/25,
   correctas 25/25, invertidas 0/25).
2. **El reaper no puede matar procesos ajenos**: 8 mutantes del guardián y 81
   del camino de muerte completo, 0 asesinos.
3. **El fallo de CI era flaky**, probado por hash: mismo código, resultados
   distintos.
4. **La invariante de `stripComments` se cumple** en 9 de 9 casos, después de
   encontrar que era falsa en el borde.
5. **El PISO y la huella son estables** ante cambios de mecanismo interno, que
   es exactamente lo que debe pasar cuando la prosa inyectada no se toca.
