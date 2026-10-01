# AOI — Auditoría del cambio sin commitear: asignación de modelos por categoría

**Fecha**: 2026-09-28
**Revisión auditada**: `v2.5.2-160-g12fc8db-dirty` · diff contra `HEAD` con SHA-256 `052e4adbfa02…`
**Auditor**: Claude Opus 5.5 (contexto 1M) — `claude-opus-5-5[1m]`, vía Claude Code
**Alcance**: 127 rutas sin commitear (128 archivos, +4657/−1342 en el índice; 19 archivos con cambios no indexados encima)

> **Por qué el sello lleva un hash.** El árbol está sucio: `git describe` identifica el
> commit base pero no el estado auditado. El hash de `git diff HEAD` fija cuál de los
> infinitos estados sobre `12fc8db` es el que se midió. Si el diff cambia, este informe
> deja de describirlo.

---

## 1. Veredicto

La cadena está verde, pero el cambio **no cumple lo que promete**. Construyó quién
*escribe* la asignación (`provider-plan.mjs` → Step 3b de `/init` → `icm facts set`) y dejó
sin cablear quién la *lee*. Es el mismo defecto que la auditoría anterior vino a cerrar
—"escribir una invocación en prosa no cablea nada"—, ahora en el extremo opuesto.

| Verificación | Resultado |
| :--- | :--- |
| `pnpm test` (cadena completa) | ✅ 1701 pass · 0 fail · 1 skipped |
| `aoi:routing`, `aoi:providers`, `test:parity`, `aoi:srp`, `aoi:reachability`, `aoi:lint-refs`, `aoi:entry-points` | ✅ |
| Idempotencia de `compile-rules.mjs --workspace AOI` (sobre copia) | ✅ 0 archivos cambiados |
| Banda inyectada por delegación | ✅ `BAND_CEILING` 8081 → 7453 (**−628 tokens por inyección**) |
| Camino de consumo de `assignment.*` | ❌ inexistente (C1) |

---

## 2. Hallazgos

> La columna **Resuelto en** se agregó después de sellar el informe. El resto describe el
> estado `052e4adbfa02…` tal como se midió.

Además, durante la remediación apareció un defecto anterior a este cambio, fuera del
alcance sellado: `parseFactTable` (`contract-facts.mjs`) descartaba en silencio cualquier
fact cuya clave llenara la columna de 32 caracteres de `icm`, así que la Invariant Gate
perdía invariantes `never` con clave larga. Se corrigió en la misma rama, con test.

| ID | Sev. | Hallazgo | Evidencia | Resuelto en |
| :--- | :--- | :--- | :--- | :--- |
| C1 | Crítico | Nadie lee la asignación persistida | ver §3.1 | `feat/provider-assignment-at-setup` — `provider-store.mjs --resolve`; Step 1 de `agent-delegation` lo exige |
| C2 | Crítico | Override de Genesis huérfano: se pierde la excepción de costo del Owner | ver §3.2 | `feat/provider-assignment-at-setup` — Genesis corre en sesión: se retiró la promesa de override |
| C3 | Crítico | Ningún gate valida los facts persistidos contra el manifiesto | ver §3.3 | `feat/provider-assignment-at-setup` — `aoi:providers` falla con `ASIGNACIÓN MUERTA` |
| A1 | Alto | Sondeo por proveedor, pero dos de las cuatro clases de error son por modelo | ver §3.4 | `feat/provider-assignment-at-setup` — `/aoi-providers` sondea por modelo, no por proveedor |
| A2 | Alto | `/init` manda a "caer al picker"; `model-selection` manda a PARAR | ver §3.5 | `feat/provider-assignment-at-setup` — una sola regla: sin modelo, PARAR |
| A3 | Alto | Prosa de compuertas y reglas desactualizada, en superficies siempre inyectadas | ver §3.6 | `feat/provider-assignment-at-setup` |
| A4 | Alto | La fuente de proveedores se elige por orden alfabético del id de perfil | ver §3.7 | `feat/provider-assignment-at-setup` — documentado y advertido; no resuelto (ver propuesta §A) |
| M1 | Medio | La sonda conductual acepta la respuesta que dice vigilar | ver §3.8 | `feat/provider-assignment-at-setup` — exige `--resolve`, prohíbe nombre de modelo |
| M2 | Medio | Comentario de `band-budget.mjs` con cifras que no coinciden con su tabla | ver §3.9 | `feat/provider-assignment-at-setup` |
| M3 | Medio | Justificaciones que describen scripts que ya no hacen eso | ver §3.10 | `feat/provider-assignment-at-setup` |
| M4 | Medio | La propuesta dice IMPLEMENTADO y describe otro diseño | ver §3.11 | `feat/provider-assignment-at-setup` — propuesta §A |
| B1 | Bajo | `provider-vscode-setup.ps1` sale 1, no 2; `$(date …)` no corre en PowerShell | **diferido** — sin `pwsh` en esta máquina | diferido (sin `pwsh`) |
| B2 | Bajo | `REGISTRY`/`AGENTS_DIR` redefinidos en tres módulos; `NOT_AN_AGENT` es un `Set` vacío | lectura de código | parcial: `provider-assignment` importa las constantes; `NOT_AN_AGENT` sigue |

---

## 3. Detalle

### 3.1 C1 — Nadie lee la asignación persistida

- `agent-delegation.instructions.md:20` — Step 1: *"`model` — exact value for the
  `runSubagent` parameter"*, a buscar en el Registry. `:55` — Step 3:
  `model: "[model from Registry]"`. **El Registry ya no tiene columna de modelo.**
- `:135`, `:141` — los anti-patrones usan `asignado("Implementación")`, una función que no
  existe en ningún lado.
- Ningún prompt, agente ni script ejecuta `icm facts get … assignment.*` (búsqueda con
  `-uu` sobre todo el árbol; sólo aparece `facts set` en el plan).
- **La premisa que lo compensaba es falsa, medido.** `init.prompt.md:139` y
  `provider-plan.mjs:105` afirman que *"`icm wake-up` carga los facts"*. El `--help` de
  `icm wake-up` dice que selecciona **memorias** critical/high. Se comprobó con dos facts
  reales de `AOI` (`architecture.archify.system`, `architecture.index.git_tracked_files`):
  **0 apariciones** en la salida de `icm wake-up -p AOI`.

**Consecuencia en tokens**: el delegador no tiene el valor y lo adivina, lo escribe en duro
o pregunta. Cada adivinanza errada es una delegación que falla con *"Requested model not
found"* y se reintenta: el costo de C7 vuelve, ahora sin un gate que lo detecte.

### 3.2 C2 — Override de Genesis huérfano

`sdd-genesis.prompt.md:16` promete `{WORKSPACE}.assignment.agent.sdd-genesis`. Ni
`provider-plan.mjs` ni el Step 3b de `/init` emiten esa clave, y nada la lee. La propuesta
(§5, Paso 4) sí la diseñó. Antes la decisión era un modelo *flash* por costo y latencia;
ahora Genesis cae en el modelo general de `Razonamiento`. **Es una regresión de economía de
tokens** en la fase de diálogo más larga del ciclo.

### 3.3 C3 — Ningún gate valida lo persistido

`provider-assignment.mjs` no invoca `icm` en ningún punto. Chequea vocabulario de categorías
y coherencia bloque↔registro, pero nunca compara `assignment.*` contra los modelos
descubiertos. Un id muerto, o el placeholder literal que emite el plan
(`"<el value de la sonda elegida>"`, `provider-plan.mjs:65`), queda en verde. La regla
*"se rechaza un proveedor caído"* existe sólo como prosa para el LLM.

Además, la línea final *"los proveedores configurados alcanzan para resolver"* sólo exige
`entries.length > 0`, y la columna "candidatos" muestra el mismo número (12) para ambas
categorías: no discrimina nada.

### 3.4 A1 — Granularidad del sondeo

`provider-plan.mjs:48-55` sondea **un** modelo por proveedor, con el argumento de que
comparten credencial y saldo. Vale para `Insufficient balance`. No vale para
`Access to model denied` ni `Requested model not found`, que son **por modelo** —el caso
del Proveedor B de la auditoría anterior fue exactamente ese. Si en el paso 2 se elige otro
modelo del mismo proveedor, ese modelo nunca se sondeó.

### 3.5 A2 — Instrucciones contradictorias sin proveedores

- `init.prompt.md:144`: *"Delegation will fall back to whatever the picker has selected."*
- `model-selection.instructions.md:22`: *"si ninguno está disponible, el agente **DEBE PARAR
  y notificar**."*

Las dos se inyectan en el mismo ciclo y ordenan lo contrario.

### 3.6 A3 — Prosa desactualizada en superficies siempre inyectadas

- `claude-project-guide.mjs:251` — `aoi:routing` *"an agent with no model, no fallback"*:
  ahora valida categoría.
- `claude-project-guide.mjs:252` — `aoi:providers` *"a registry value that resolves to no
  model in the provider manifest"*: no hace eso (C3).
- Ambas se compilan a `CLAUDE.md` y a los otros cinco dialectos, que están en contexto
  permanente.
- `model-selection.instructions.md:21` — *"Si no está, el `Fallback`"*: ya no existe un
  fallback; el plan persiste un único valor por categoría.
- `agent-delegation.instructions.md` — *"`pnpm aoi:providers` lo deriva y lo verifica"*
  (el sufijo `(customendpoint)`): el gate no verifica ningún identificador.

### 3.7 A4 — Selección de perfil por orden alfabético

`provider-config.mjs` ordena los ids de `profiles/` con `.sort()` y toma el primero que
tenga modelos. Medido en esta máquina:

| Ubicación | Presente | Modelos |
| :--- | :-: | --: |
| `profiles/-5f85a270/chatLanguageModels.json` | sí | 12 |
| `profiles/builtin/chatLanguageModels.json` | no | 0 |
| `ChatLanguageModel.json` | sí | 5 |
| `chatLanguageModels.json` | sí | 0 |

Acierta aquí porque `-` ordena antes que `b`. El propio `scaffold/.vscode/README.md` admite
el caso que rompe: *"si el workspace usa el perfil por defecto, la autoritativa es la
segunda"*, pero el detector elegirá igual cualquier perfil con modelos. El criterio no mira
`profileAssociations`, que es lo que VS Code usa.

### 3.8 M1 — La sonda acepta lo que dice vigilar

`behavioral-scenarios-entry.mjs`, sonda de `Phase_2_FF`. Medido con respuestas concretas
contra `expected`:

| Respuesta | Resultado |
| :--- | :--- |
| "No sé cuál es la asignación." | PASA |
| "Uso GLM-5.2 (customendpoint), no hace falta ninguna asignación" | **PASA** |
| "Leo icm facts get assignment.Razonamiento" | PASA |
| "Del registro de agent-delegation, columna model" | falla |

El comentario afirma que *"nombrarlo en la respuesta ahora es el defecto"*; la sonda da por
buena la respuesta que escribe el modelo en duro.

### 3.9 M2 — Cifras del comentario de `band-budget.mjs`

| Dato | Comentario | Tabla/constante real |
| :--- | :--- | :--- |
| Techo de banda | 8.066 → 7.458 | 8081 → **7453** |
| `agent-delegation` | 1.851 → 1.311 | 1860 → **1308** |
| `model-selection` | 390 → 330 | 396 → **328** |
| Movimientos enumerados | "los otros tres" | lista **dos** |

La convención del repo: un motivo desactualizado es peor que ninguno, porque se cree.

### 3.10 M3 — Justificaciones de scripts que ya no hacen eso

- `provider-config.mjs` justifica no replicar `profileAssociations` porque
  `provider-vscode-setup.sh` *"escribe"*. Ya no escribe.
- `scaffold/.vscode/README.md` atribuye la copia del template a
  `provider-vscode-setup.{sh,ps1}`; lo que copiaba era `nvidia-vscode-setup.{sh,ps1}`.

### 3.11 M4 — La propuesta diverge de lo implementado

`AOI_PROVIDER_ASSIGNMENT_2026-09-28.md` se declara **IMPLEMENTADO**, pero:

- especifica `providers.{p}.status`, `providers.{p}.detail`, `providers.checkedAt` y
  `assignment.agent.*`; el código emite sólo `assignment.<Categoría>` y `resolvedAt`;
- el encabezado dice "queda un solo pendiente" y la §11 lista tres;
- el pendiente 1 (qué hacer sin proveedores) ya lo decidió el código —avisa y sigue— y el
  documento no lo refleja.

---

## 4. Lo que está bien

- `provider-config.mjs` descarta `apiKey` en la lectura: el reporte no puede filtrarla.
- Los chequeos de entorno se declaran **OMITIDOS** sin configuración, no verdes; un registro
  vacío falla en los dos gates.
- Retirar la columna de proveedor ahorra 628 tokens en **cada** delegación. Es ahorro
  recurrente y real.
- Eliminar el template y el configurador de NVIDIA es correcto: el template no podía
  resolver en otra máquina y el flujo viejo sobrescribía la configuración que funcionaba.
- `estimateTokens` quedó como fuente única en `ast-skeletonizer` y `sdd-stress-suite`.
- La compilación de reglas es idempotente sobre el árbol actual.

---

## 5. No verificado

- **B1**: no hay `pwsh` en esta máquina. Se difiere, no se corrige a ciegas.
- **Claves con tilde** (`assignment.Implementación`) en `icm facts set`: no se escribió en
  ICM para probarlo, porque sería mutar estado fuera del repo durante una auditoría.
- **Ciclo real en AOI TESTS**: no se ejecutó. Ningún ciclo SDD pasó todavía por el Step 3b.

---

## 6. Orden de remediación sugerido

Va en una rama aparte; este informe queda describiendo el estado sellado arriba.

1. **C1** — que el Step 1 y el Step 3 de `agent-delegation` manden a leer
   `icm facts get "{WORKSPACE}" "assignment.<Categoría>"` (y el override de agente primero),
   y corregir la afirmación sobre `icm wake-up` en `/init` y en el plan.
2. **C2** — decisión del Owner: o el plan emite `assignment.agent.sdd-genesis`, o se retira
   la promesa del prompt.
3. **C3** — en `aoi:providers`, leer los facts con `--read-only` y compararlos contra los
   modelos descubiertos. Cero tokens de inferencia.
4. **A2 + A3** — una sola regla para el caso sin proveedores, y la prosa de las compuertas
   alineada con lo que hacen.
5. **A1, A4, M1–M4** — en el mismo pase de limpieza.
6. Ejecutar el protocolo en `/Users/equinox/Desktop/AOI TESTS`, incluido
   `pnpm aoi:stress-sdd`, y registrar el delta contra la línea base.
