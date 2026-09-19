# Revisión técnica — Plan de Aislamiento Concurrente de Ciclos SDD mediante Git Worktrees

**Modelo auditor:** Deepseek v4 flash — Provider: Deepseek

> **Nota de estado (2026-09-18, posterior a la emisión).** El motor auditado fue
> **revertido**: la rama `feat/sdd-worktree-isolation` no se integró y `main` nunca
> contuvo este código. Los comandos de este informe se escriben sin el runner `node`
> a propósito — **no son ejecutables**, son la cita histórica de lo que el motor
> exponía en `4eeb157`. Ver `AOI_WORKTREE_ISOLATION_REVIEW_2026-09-18_v2.5.2-103-g4eeb157.md`,
> apéndice B, para el motivo del rollback.
**Fecha:** 2026-09-18
**Objeto revisado:** "Plan de Implementación: Aislamiento Concurrente de Ciclos SDD mediante Git Worktrees"
**Alcance del trabajo:** verificación contra el repositorio real, no lectura del plan como texto
**Naturaleza:** revisión con evidencia reproducible. Todo defecto aquí listado fue medido, no inferido.

**Rama evaluada:** `feat/sdd-worktree-isolation` @ `4eeb157`
**Rama base:** `main` @ `3e3fad3` (`origin/main`)

---

## 1. Veredicto en una línea

El primitivo elegido es correcto y la implementación tiene decisiones de seguridad sólidas —pero **el plan describe como pendiente algo que ya está commiteado**, y la implementación arrastra **dos defectos que producen falsos positivos silenciosos en el gate de Archive**, activados precisamente por la convención operativa que el propio plan prescribe.

> Un gate que reporta `{"success": true, "mergedInto": "main"}` sin haber tocado `main` es más peligroso que un crash. Un crash se ve. Esto se cree, se escribe en el reporte de verificación, y la tarea se archiva con el trabajo todavía en el sandbox.

---

## 2. Estado real del repositorio (lo primero que hay que saber)

**El plan no es un plan pendiente: es la descripción de trabajo ya realizado.**

| El plan declara | Estado real medido |
| :--- | :--- |
| `[NEW] scripts/sdd-lifecycle/task-worktree-ops.mjs` | **Ya existe** — 147 LOC |
| `[MODIFY] task-worktree.mjs` (~150 LOC) | **Ya existe** — 231 LOC, ya modularizado |
| `[MODIFY] task-worktree.test.mjs` — "7/7 tests" | **Ya existe** — 159 LOC, 7/7 en verde |
| Fix de `.gitignore` en el test temporal | **Ya aplicado** (línea 28 del test) |
| `[MODIFY] sdd-apply.prompt.md` | **Ya cableado** — `sdd-apply.prompt.md:64` |
| `[MODIFY] sdd-verify.prompt.md` | **Ya cableado** — 8 referencias a `sandbox\|worktree\|Cwd` |
| `[MODIFY] sdd-archive.prompt.md` | **Ya cableado** — `:171` merge, `:175` remove |
| Dashboard: `types.ts`, snapshot, 2 componentes | **Ya hechos** (+ su test) |
| Espejo en `scaffold/` | **Ya espejado** |

### Evidencia de las compuertas (medida en la rama actual)

```
pnpm aoi:srp      → Scanned: 238 source file(s) · limit 300 LOC
                    ✅ No new SRP violations. 4 legacy file(s) still over the limit.

pnpm test:parity  → 205 tests · 205 pass · 0 fail

node --test scripts/sdd-lifecycle/task-worktree.test.mjs
                  → 7 tests · 7 pass · 0 fail
```

### Archivos del dashboard efectivamente tocados

```
shared/types.ts:57,69                              → TaskWorktreeRecord + campo worktree en TaskRecord
server/utils/build-workspace-snapshot.ts:159,174   → detección de .sandboxes/{TASK-ID}
app/components/TaskDetailPanel.vue:136             → panel con branch + path
app/components/TaskSummaryCard.vue:81              → badge condicional
test/server/build-workspace-snapshot.test.ts:89    → test de la detección
```

**Consecuencia práctica:** ejecutar el plan tal como está escrito significa re-hacer trabajo ya hecho. Si el documento es un diseño a revisar, hay que corregirlo para que refleje `4eeb157`. Si es un plan a ejecutar, le faltan exactamente los puntos de la sección 4.

---

## 3. Lo que el plan acierta (y no es poco)

Quiero ser justo donde corresponde. Estas decisiones están bien tomadas y sostienen el valor de lo construido:

### 3.1 El primitivo es el correcto
`git worktree` sobre `git stash` o copia del árbol. Stash serializa (no hay concurrencia) y copiar el árbol pierde la historia de git. Worktree da árboles separados sobre el mismo object store, que es exactamente el problema planteado.

### 3.2 `execFile` en lugar de `exec`
`runGit()` usa `promisify(execFile)` con array de argumentos, sin shell. Esto no es decorativo: `exec` con interpolación de strings sobre un `taskId` que viene de un prompt de agente es un vector de inyección.

### 3.3 `sanitizeTaskId()` cierra el path traversal
```js
if (!/^[A-Za-z0-9_-]+$/.test(clean)) throw new Error(`Invalid Task ID...`)
```
Bloquea `TASK/001`, `TASK..001; rm -rf`, y cualquier separador de path. Sin esto, `path.join(root, '.sandboxes', taskId)` es un traversal trivial. El test lo verifica (líneas 50-55).

### 3.4 `canonicalPath()` con `realpathSync`
Ataca el clásico `/var` vs `/private/var` de macOS, que rompe comparaciones de path de forma intermitente y es notoriamente difícil de diagnosticar. El test lo usa en `before()` (`fs.realpathSync(rawTmp)`). Bien visto.

### 3.5 El test es de integración real
No mocks: repo git temporal con `git init`, commits reales, dos worktrees simultáneos. Por eso el 7/7 tiene valor. Un test con mocks habría pasado igual con el motor roto.

### 3.6 Modularización respetando Invariante 5
231 + 147 LOC, verificado con `aoi:srp` sin violaciones nuevas. El plan menciona que el prototipo llegó a 344 LOC y se dividió — la división está bien ejecutada y las responsabilidades están limpias (primitivas puras vs orquestación).

### 3.7 Costo 0 en tokens
`child_process` + `git`, sin APIs. La afirmación del plan es correcta para el motor.

### 3.8 El `parseWorktreeList()` filtra correctamente
Delimita por `.sandboxes/` con `path.relative` + `replaceAll('\\', '/')`. Correcto en Windows también.

---

## 4. Defectos verificados

Los defectos están ordenados por severidad real, no por orden de descubrimiento.

### 🔴 D1 — CRÍTICO: `resolveWorkspaceRoot()` resuelve al sandbox cuando el cwd está adentro

**Qué hace el código** (`task-worktree-ops.mjs`, `resolveWorkspaceRoot`):

```js
let curr = canonicalPath(startDir)
while (curr !== path.dirname(curr)) {
  if (fs.existsSync(path.join(curr, '.git'))) {
    return curr          // ← se detiene en el primer .git que encuentra
  }
  curr = path.dirname(curr)
}
```

**Por qué está mal:** dentro de un worktree, `.git` **no es un directorio: es un archivo** (`gitdir: /ruta/al/.git/worktrees/<name>`). `fs.existsSync()` no distingue. La caminata se detiene en el sandbox.

**Y el plan manda operar exactamente así.** Textual:

> *"todas las escrituras de código, compilaciones y ejecuciones de tests deben tener como `Cwd` la ruta `.sandboxes/{TASK-ID}`"*

O sea: la convención que el plan prescribe es la que activa el bug. No es hipotético.

**Medición** (`probe-worktree-root.mjs`):

```json
{
  "dotGitInSandboxIsFile": true,
  "resolvedRootFromInsideSandbox": ".../aoi-probe-nFtxVz/.sandboxes/TASK-A",
  "rootResolutionIsCorrect": false,
  "listFromRepoRoot": ["TASK-A", "TASK-B"],
  "listFromInsideSandbox": [],
  "listFromInsideSandboxIsCorrect": false,
  "nestedWorktreeCreatedFromInsideSandbox": ".../TASK-A/.sandboxes/TASK-NESTED"
}
```

Tres síntomas, todos silenciosos (exit 0 en los tres):

1. **`list` miente.** Devuelve `[]` con 2 worktrees activos.
2. **`create` anida.** Crea `.sandboxes/TASK-A/.sandboxes/TASK-NESTED`, un worktree dentro de otro.
3. **`create` reusa mal.** El guard `if (fs.existsSync(worktreePath))` evalúa un path relativo al sandbox, así que puede creer que un worktree existe cuando no existe, o crearlo duplicado.

### 🔴 D2 — CRÍTICO: `merge` y `remove` reportan éxito sin hacer nada

Este es el defecto que más me preocupa, porque corrompe la compuerta de Archive.

**Ground truth medido** (`probe-worktree-merge-false-positive.mjs`, cwd dentro del sandbox, con un commit real en la rama):

```json
{
  "statusReported": { "exists": false, "dirtyFiles": [], "commitsAhead": 0 },
  "mergeReported":  { "success": true, "mergedInto": "main" },
  "removeReported": { "success": true, "removed": true },

  "GROUND_TRUTH": {
    "mainActuallyHasFeatureA": false,
    "sandboxStillOnDisk":     true,
    "branchStillExists":      true,
    "worktreesStillRegistered": "<ambos worktrees siguen registrados>"
  },

  "VERDICT": {
    "mergeReportedSuccessButMainUnchanged":     true,
    "removeReportedSuccessButNothingRemoved":   true
  }
}
```

**Mecánica exacta de cada mentira:**

| Reporta | Por qué miente |
| :--- | :--- |
| `status.exists: false` | `worktreePath` se calcula como `<sandbox>/.sandboxes/TASK-A`, que no existe. El path reportado en la salida lo delata: termina en `TASK-A/.sandboxes/TASK-A`. |
| `dirtyFiles: []` | El chequeo corrió sobre un directorio inexistente. La guarda de `merge` (que lanza si hay sucio) **pasa vacía**. |
| `commitsAhead: 0` | `git rev-list --count task/TASK-A ^HEAD` ejecutado desde el sandbox: `branch == HEAD` → 0. |
| `merge.success: true` | Corre `git merge --no-ff task/TASK-A` estando **parado en** `task/TASK-A`. Git responde *"Already up to date"*. Exit 0. |
| `remove.success: true` | Borra un path inexistente, y el `catch {}` sin cuerpo se come el rechazo de `git branch -d` sobre la rama actualmente chequeada. |

**Por qué es peor que un fallo:** el camino falso es exitoso, silencioso y coherente. Alimenta directamente a `sdd-archive.prompt.md`, que instruye:

```bash
scripts/sdd-lifecycle/task-worktree.mjs merge {TASK-ID}     # :171
scripts/sdd-lifecycle/task-worktree.mjs remove {TASK-ID}    # :175
```

Un agente leyendo `{"success": true, "mergedInto": "main"}` da el Archive por aprobado. El trabajo queda en el sandbox, `main` intacta, y el reporte dice lo contrario.

### 🟠 D3 — La regla "NO HACER COMMIT" hace inejecutable el ciclo que el plan diseña

El plan declara como invariante:

> *"No se ejecutará `git commit` ni `git push` en el repositorio principal sin autorización explícita del usuario."*

Pero `mergeTaskWorktree()` **lanza** si hay archivos sucios:

```js
if (status.exists && status.dirtyFiles.length > 0) {
  throw new Error(`Cannot merge task worktree for "${taskId}": there are N uncommitted changes`)
}
```

Y sin commits en la rama, no hay nada que mergear. **Bajo la regla, `/sdd-archive` es inejecutable, siempre.** El plan se contradice con su propio motor.

**Agravante:** la regla ya está rota. `4eeb157` **es** un commit, en la rama `feat/sdd-worktree-isolation`. El invariante se declaró y se violó en la misma pieza de trabajo.

**Nota de interpretación:** la restricción de no tocar `main` sin autorización es razonable. Lo que no cierra es la redacción — se lee como "no commitear nunca", cuando el ciclo necesita commits en `task/*`. Hay que separar ambos casos.

### 🟠 D4 — Colisión de subsistemas: `.sandboxes/` ya tiene dueño

El plan trata `.sandboxes/` como espacio libre. **No lo es.** Ya existe un subsistema de sandboxes con semántica propia:

| Superficie preexistente | Qué es |
| :--- | :--- |
| `.github/prompts/sandbox-new.prompt.md` | Punto de entrada manual, "the single manual entry point" |
| `.sandboxes/registry.md` | **Trackeado**. Tabla + leyenda de estados 🟢🔄📦⏸️ |
| `.sandboxes/_templates/` | `constitution.template.md`, `integration-manifest.template.json` |
| `.sandboxes/{name}/config.md` | Identidad estática, inmutable |
| `.sandboxes/{name}/constitution.md` | Gobernanza viva, versionada |
| `.sandboxes/{name}/integration-manifest.json` | Intención de integración, con `compartments[]` |
| `.sandboxes/{name}/exports/` | Export/import |

Tras la fusión, `.sandboxes/` tiene **dos semánticas incompatibles**:

- `/sandbox-new`: sandbox de **investigación**, con constitution e integration-manifest, converge a `main`.
- `task-worktree`: sandbox de **ejecución**, con rama `task/*`.

Y dos registros de la misma carpeta:

- `registry.md` — tabla mantenida a mano por `/sandbox-new`
- `git worktree list` — registro de git, leído por `listTaskWorktrees()`

`listTaskWorktrees()` filtra `.sandboxes/*` pero **solo ve worktrees**. Un sandbox creado por `/sandbox-new` es invisible para él, y un worktree es invisible para `registry.md`. Dos verdades paralelas sobre la misma carpeta.

**Riesgo concreto:** `/sandbox-new TASK-2026-001` colisiona con el worktree en `.sandboxes/TASK-2026-001`. El mismo path, dos dueños, sin arbitraje.

### 🟠 D5 — `teardown.sh` destruye worktrees activos

`teardown.sh:89`:

```sh
remove_dir ".sandboxes"
```

y `teardown.sh:58` incluso lo anuncia: `printf "  .sandboxes/ (sandbox environments)\n"`.

Ejecutar teardown con worktrees activos borra el árbol y **el trabajo sin commitear adentro**. El plan no lo menciona y no hay ninguna guarda. Con el subsistema viejo (`config.md` + registry) el borrado era de metadatos; con worktrees ahora es de código.

### 🟠 D6 — La "aislación" de dependencias es falsa

`linkDependencies()` enlaza **solo** `node_modules` de la raíz:

```js
const rootNodeModules = path.join(cRoot, 'node_modules')
```

Dos agujeros verificados:

1. **`aoi_apps/agentic-ops-dashboard/node_modules` EXISTE y no se enlaza.** Los tests del dashboard dentro del sandbox no resuelven dependencias. Justo la suite que la Fase 3 del plan manda correr.

2. **`pnpm install` dentro de un sandbox muta el store compartido.** El store de pnpm es global (`~/.pnpm-store` o `node_modules/.pnpm`); instalarlo desde un worktree no aísla nada en la capa de dependencias. La promesa de aislamiento total no aplica acá.

**Agravante de diseño:** los dos `catch {}` de `linkDependencies` están vacíos. Un fallo de symlink (permisos, filesystem restrictivo) produce un sandbox sin dependencias, sin error, sin traza. El síntoma aparece después como "los tests fallan raro en el sandbox".

### 🟡 D7 — `baseBranch` default es `HEAD`, no `main`

```js
const baseBranch = options.baseBranch || 'HEAD'
```

Hoy `HEAD` está en `feat/sdd-worktree-isolation` (`4eeb157`) y `main` en `3e3fad3`. Una tarea creada sin `--base` nace de la rama de feature, y `mergeTaskWorktree` (que apunta a `main` por default) **arrastraría la rama de feature entera a `main`**.

Es un footgun vivo, no hipotético: es el estado actual del repo.

### 🟡 D8 — Los 7 tests evitan el escenario que el prompt prescribe

Leí el test completo. Las siete invocaciones pasan `root` explícito:

```js
await createTaskWorktree({ taskId: 'TASK-2026-001', root: tmpRepo })
await mergeTaskWorktree({ taskId: 'TASK-2026-001', root: tmpRepo })
await removeTaskWorktree({ taskId: 'TASK-2026-001', root: tmpRepo, force: true, ... })
```

**Ningún test cambia el cwd a un sandbox.** Es decir: el 7/7 pasa porque la suite nunca ejecuta el modo que `sdd-apply.prompt.md` instruye. El agujero de cobertura está alineado exactamente con D1 y D2.

Esto es lo que hace que "7/7 en verde" sea información engañosa en este caso. No es un test mal escrito —es un test que cubre el 100% de los casos que no rompen.

### 🟡 D9 — `mergeTaskWorktree` ignora el parámetro que recibe

```js
export async function mergeTaskWorktree(options) {
  const targetBranch = options.targetBranch || 'main'
  // ...
  await runGit(['merge', '--no-ff', branchName, '-m', `merge: integrate ${taskId} ...`], root)
  return { success: true, taskId, mergedInto: targetBranch }   // ← reporta, no usa
}
```

`targetBranch` **se reporta pero nunca se usa**. El merge ocurre contra la rama actualmente chequeada en `root`, que es `main` **solo si nadie cambió de rama**. El `mergedInto` de la respuesta es una suposición sobre el estado de `root`, no un hecho verificado.

Corolario directo: si el Owner está parado en `feat/sdd-worktree-isolation`, el merge va a esa rama y el reporte dice `"mergedInto": "main"`.

### 🟡 D10 — Concurrencia sin dueño

Nada impide que dos agentes ataquen el mismo `TASK-ID`. Ambos calculan el mismo path, el segundo recibe `{ success: true, reused: true }` y los dos escriben en el mismo árbol. **Es la misma colisión de archivos que el plan dice resolver, un nivel más abajo.** No hay lockfile, no hay detección de colisión, no hay PID ni owner en el manifest del worktree.

### ⚪ D11 — Incoherencias menores y afirmaciones no verificadas

| Afirmación del plan | Hallazgo |
| :--- | :--- |
| "generan documentación en `.agents/` o `.specs/`" | `.specs/` **no existe**. `.agents/` sí. |
| `.blueprints/*` (mencionado en `.gitignore`) | `.blueprints/` **no existe** en el repo. |
| "arranque en **< 500 ms**" | Medí 71 ms, pero en un repo de **2 archivos**. En AOI son 1197 trackeados + espejo completo. **<500 ms no está medido en condiciones reales.** |
| "sin falsos positivos en suites de prueba TDD" | No hay evidencia de que el escáner respete `.gitignore`. Ver 4.2. |
| Aislamiento de memoria ICM | El protocolo ICM §6 pide sandboxes read-only con prefijo `sandbox-{WORKSPACE}-{name}`. El plan **no dice qué topics escribe el agente aislado**. La DB de ICM es global y queda fuera del worktree. |
| `.specify/memory/versions/active.json` | Global, fuera del worktree. Lo mismo que ICM. |

### Nota metodológica: por qué D1 y D2 sobrevivieron al 7/7

Vale explicitar el patrón, porque se va a repetir: **una suite verde sobre los casos fáciles es indistinguible de una suite verde sobre los casos que importan.** El plan cita "7/7 tests aprobados" como evidencia de corrección. Los 7 pasan; los dos defectos críticos también.

---

## 5. Observaciones arquitectónicas

### 5.1 Resuelve la colisión barata e ignora las caras

El plan resuelve la colisión de **archivos**. Bajo concurrencia real, la colisión de archivos es la parte fácil: git la maneja.

Las colisiones que quedan **fuera** del worktree, y que el plan no menciona:

| Recurso | Estado | Problema bajo concurrencia |
| :--- | :--- | :--- |
| `.tasks/registry.md` | **Trackeado** | Cada transición de fase lo actualiza. Dos ciclos divergen y **conflictúan justo en el merge** que el plan propone como mecanismo de integración. |
| `.specify/memory/versions/active.json` | Global | Fuera del worktree. Sin aislamiento. |
| DB de ICM | Global | Fuera del worktree. Sin aislamiento. |
| Store de pnpm | Global | `pnpm install` en un sandbox muta el compartido (ver D6). |

**La ironía central del diseño:** los worktrees *empeoran* la concurrencia sobre `.tasks/registry.md`. Antes, dos agentes escribían en un solo árbol y el filesystem serializaba de hecho (uno pisaba al otro, pero sobre un archivo). Ahora son dos ramas que divergen garantizado y hay que unir explícitamente — el conflicto se **difiere** al merge en lugar de resolverse antes.

Si la respuesta es "se conflictúa en el merge", entonces **la concurrencia que el plan promete no existe** para ese archivo.

### 5.2 Un gate que no puede fallar no es un gate

D2 expone un patrón que excede a este módulo: `merge` y `remove` devuelven `success: true` como constante estructural. En ninguna rama de ejecución existe un camino a `success: false`. Combinado con los `catch {}` vacíos de D6 y del `remove`, el motor **no tiene superficie de fallo**.

Es la misma clase de defecto que `CLAUDE.md` documenta en otras partes de AOI ("una compuerta juzgaba la instalación con la vara del repo", "la protección de los directorios de estado medía uno de cuatro", "la paridad medía el disco, y el disco no es lo que se shippea"). Vale alinearlo con esa doctrina: **una compuerta que no puede fallar es decoración.**

### 5.3 El espejo de scaffold y la decisión de la máquina de estados quedan sin tocar

El plan exige paridad (correcto) pero no discute un punto que sí importa: un worktree **no puede contener `.sandboxes/` adentro** (lo verifiqué: el path anidado se crea, pero es basura). Sin embargo el worktree **sí** materializa el árbol completo de AOI, incluyendo `scaffold/` — un espejo de 1000+ archivos duplicado por cada tarea concurrente.

No es un bug, pero es un costo que el "<500 ms" del plan no contempla.

---

## 6. Recomendaciones priorizadas

El orden importa: cada paso desbloquea el siguiente.

### P0 — Antes de cualquier otra cosa

**R1. Arreglar la resolución de raíz.**
Reemplazar la caminata por `fs.existsSync('.git')` con `git rev-parse --path-format=absolute --git-common-dir`, que devuelve el `.git` **compartido** desde adentro de un worktree. Alternativa sin subproceso: detectar que `.git` es archivo y leerle el `gitdir:`.

```js
// El .git de un worktree es un ARCHIVO con "gitdir: <ruta>/worktrees/<name>"
// El common dir es el padre de .git/worktrees.
```

**R2. Hacer que `list`, `merge` y `remove` fallen ruidosamente.**
Si el path resuelto como raíz es a su vez un worktree conocido, **abortar con exit 1**. Un gate tiene que poder fallar. Junto con esto, sacar los `catch {}` vacíos: un symlink fallido y una rama no borrada tienen que ser errores, no silencios.

**R3. Agregar los tests que cubren el modo prescrito.**
Ejecutar con `cwd` dentro del sandbox y asertar que:
- `listTaskWorktrees()` devuelve el mismo conjunto que desde la raíz (no `[]`)
- `getTaskWorktreeStatus()` reporta `exists: true` y el `commitsAhead` real
- `mergeTaskWorktree()` **no** reporta `success: true` si `main` no cambió
- `removeTaskWorktree()` **no** reporta `removed: true` si el path sigue en disco

Estos cuatro son el gate de regresión de R1 y R2. Sin ellos, el bug vuelve.

**R4. Resolver la contradicción commit / no-commit.**
Definir explícitamente: **commits sí, y solo en `task/*`**. `main` permanece intacta hasta el merge, que requiere autorización. Eso satisface la intención del Owner sin hacer inejecutable el ciclo.

### P1 — Antes de cablear el ciclo completo

**R5. Decidir quién manda en `.sandboxes/`.**
Dos opciones, ambas defendibles:
- **(a) Unificar:** un solo concepto de sandbox, con `worktree` como uno de sus modos. Toca `/sandbox-new`, `registry.md` y `listTaskWorktrees()`.
- **(b) Separar:** mudar los worktrees a `.worktrees/{TASK-ID}`, dejando `.sandboxes/` para los sandboxes de investigación. Cambio chico, cero riesgo de colisión semántica.

Mi recomendación es **(b)** salvo que haya intención deliberada de converger los dos subsistemas. Es la opción que no rompe nada existente y no obliga a rediseñar `/sandbox-new`.

**R6. Guarda en `teardown.sh`.**
Antes de `remove_dir ".sandboxes"`, verificar que no haya worktrees registrados. Si los hay, abortar y listar qué se va a destruir. Hoy el teardown borra trabajo sin commitear en silencio (D5).

**R7. `baseBranch` por defecto y `targetBranch` efectivo.**
- Default `baseBranch` a la rama principal detectada (`main`/`master`), no `HEAD`.
- `mergeTaskWorktree` debe **usar** `targetBranch`: verificar que `root` esté parado en esa rama, o ejecutar el merge de forma que no dependa de dónde está parado el repo.

### P2 — Higiene

**R8. Lockfile de tarea.** Un `.owner` o `lock` en el manifest del worktree con PID + timestamp, para que dos agentes sobre el mismo `TASK-ID` fallen en lugar de pisarse (D10).

**R9. Aislar `.tasks/registry.md` bajo concurrencia.** Definir la política explícitamente. Si la respuesta es "se conflictúa en el merge", decirlo en el documento — y explicar entonces qué parte de la concurrencia prometida es real.

**R10. Documentar el alcance real del aislamiento.** Qué queda aislado (árbol, rama, tests) y qué no (ICM, `active.json`, store de pnpm, `registry.md`). El plan actual promete aislamiento total.

**R11. Enlazar los `node_modules` anidados** o documentar que los tests del dashboard en el sandbox requieren `pnpm install` (que a su vez muta el store compartido — ver D6).

**R12. Actualizar el documento del plan** para que refleje `4eeb157`, o marcarlo como post-mortem. Hoy describe como pendiente trabajo hecho.

---

## 7. Plan de verificación propuesto

### Compuertas existentes (ya en verde, usar como baseline)

```bash
pnpm aoi:srp                                        # Invariante 5 · 238 archivos
pnpm test:parity                                    # 205 tests
node --test scripts/sdd-lifecycle/task-worktree.test.mjs
```

### Compuertas nuevas (el gate de R1/R2)

```bash
# Debe devolver el MISMO conjunto que desde la raíz, no []
cd .sandboxes/TASK-A && scripts/sdd-lifecycle/task-worktree.mjs list

# Debe FALLAR (exit 1), no reportar success
cd .sandboxes/TASK-A && scripts/sdd-lifecycle/task-worktree.mjs merge TASK-A

# Debe FALLAR si la rama sigue existiendo o el path sigue en disco
cd .sandboxes/TASK-A && scripts/sdd-lifecycle/task-worktree.mjs remove TASK-A
```

### Sondas de reproducción

Quedaron en `/Users/equinox/Desktop/AOI TESTS/` y son ejecutables por cualquiera:

| Archivo | Qué mide |
| :--- | :--- |
| `probe-worktree-root.mjs` | Resolución de raíz desde adentro del sandbox, `list` mentiroso, anidamiento de `create` |
| `probe-worktree-merge-false-positive.mjs` | Falsos positivos de `merge`/`remove` con ground truth medido desde la raíz |

Ninguna muta el repositorio real: ambas trabajan sobre repos git temporales en `os.tmpdir()` y limpian al final.

### Test de concurrencia manual (del plan, sigue siendo válido)

```bash
scripts/sdd-lifecycle/task-worktree.mjs create TASK-2026-TEST-A
scripts/sdd-lifecycle/task-worktree.mjs create TASK-2026-TEST-B
git worktree list
scripts/sdd-lifecycle/task-worktree.mjs remove TASK-2026-TEST-A --force --delete-branch
scripts/sdd-lifecycle/task-worktree.mjs remove TASK-2026-TEST-B --force --delete-branch
```

Verificar además que `main` no tenga ni `feature1.ts` ni `feature2.ts` después de la limpieza.

---

## 8. Tabla resumen de severidades

| ID | Severidad | Defecto | Activado por |
| :--- | :--- | :--- | :--- |
| D1 | 🔴 Crítico | `resolveWorkspaceRoot` resuelve al sandbox desde adentro | La convención que el plan prescribe |
| D2 | 🔴 Crítico | `merge`/`remove` reportan éxito sin actuar | D1 + cwd en sandbox |
| D3 | 🟠 Alto | "No commit" hace inejecutable el Archive | Contradicción interna del plan |
| D4 | 🟠 Alto | `.sandboxes/` con dos dueños y dos registros | Diseño, sin arbitraje |
| D5 | 🟠 Alto | `teardown.sh` destruye worktrees activos | Ejecución de teardown |
| D6 | 🟠 Alto | Aislamiento de dependencias falso | Suite del dashboard en sandbox |
| D7 | 🟡 Medio | `baseBranch` default `HEAD` → arrastra la rama de feature | Estado actual del repo |
| D8 | 🟡 Medio | Los 7 tests evitan el escenario prescrito | Cobertura |
| D9 | 🟡 Medio | `targetBranch` se reporta pero no se usa | Repo parado en otra rama |
| D10 | 🟡 Medio | Concurrencia sobre el mismo `TASK-ID` sin dueño | Dos agentes, mismo id |
| D11 | ⚪ Bajo | Afirmaciones no verificadas, paths inexistentes | Documentación |

---

## 9. Apéndice: comandos de auditoría usados

```bash
# Estado de la rama y del object store
git ls-files | wc -l                 # 1197 trackeados
git ls-files scripts | wc -l         # 266
git worktree list
git --no-pager log --oneline -12

# Qué está trackeado en las carpetas en disputa
git ls-files .sandboxes              # registry.md + 2 templates
git ls-files .tasks                  # registry.md  ← el punto de conflicto

# Dónde está cableado el motor
rg -n --no-ignore "task-worktree" .github/prompts/

# Superficies del dashboard
rg -n "worktree" aoi_apps/agentic-ops-dashboard/

# Los dos scrapers que recorren scripts/
rg -n "readdirSync|walk|ignore" scripts/scaffold/source-reachability.mjs
rg -n "sandbox|ignore|readdir" scripts/scaffold/validate-srp.mjs
```

**Nota sobre `rg` en este repositorio:** casi todo el árbol está gitignoreado. `rg` sin `--no-ignore` devuelve resultados vacíos y produce conclusiones falsas del tipo "no lo referencia nadie". **Usar siempre `--no-ignore`** para búsquedas recursivas en AOI. Los paths explícitos sí funcionan sin el flag.

---

## 10. Qué NO dice este documento

Para no sobrevender el alcance:

- **No evalué** el comportamiento del motor en Windows ni en un container. `symlinkSync` con type `'junction'` tiene semántica distinta en NTFS y en algunos filesystems de container.
- **No medí** el arranque real de un worktree sobre el árbol completo de AOI (1197 archivos + espejo). El "<500 ms" del plan sigue sin verificar en condiciones reales.
- **No evalué** el impacto de los worktrees sobre los escáneres que recorren el árbol. `source-reachability.mjs` camina solo `scripts/`, `validate-srp.mjs` saltea `scaffold/` y sigue symlinks por diseño. Un worktree vive en `.sandboxes/`, **fuera de `scripts/`** — así que a primera vista no debería afectarlos. Pero **no lo confirmé ejecutando las compuertas con un worktree vivo en disco**, y esa verificación falta.
- **No revisé** el diff de `4eeb157` en detalle, solo las superficies que el plan declara.

---

## 11. Conclusión

El trabajo hecho tiene valor real: el primitivo es correcto, `execFile` + `sanitizeTaskId` cierra un vector de inyección, `canonicalPath` resuelve un problema específico de macOS, y el test es de integración de verdad.

Pero hay que decir lo incómodo: **el documento presenta como plan algo ya commiteado, y la implementación tiene dos defectos críticos que la convención del propio documento activa.** El 7/7 y el 205/205 son reales y también son irrelevantes para esos dos defectos, porque la suite nunca ejecuta el modo que el prompt instruye.

La buena noticia es que los dos defectos críticos tienen arreglo acotado (R1 + R2, con R3 como gate de regresión) y están completamente diagnosticados. No hace falta rediseñar nada: hace falta que el gate pueda fallar.

> La regla que este caso deja: **una suite verde sobre los casos fáciles es indistinguible de una suite verde sobre los casos que importan.** Y una compuerta que no puede fallar no es una compuerta.

---

## 12. Ficha de auditoría

| Campo | Valor |
| :--- | :--- |
| **Modelo auditor** | Deepseek v4 flash |
| **Provider** | Deepseek |
| **Agente** | GitHub Copilot |
| **Fecha** | 2026-09-18 |
| **Método** | Verificación contra el repositorio con sondas reproducibles, no lectura del plan como texto |
| **Compuertas corridas** | `aoi:srp`, `test:parity`, `task-worktree.test.mjs` |
| **Rama auditada** | `feat/sdd-worktree-isolation` @ `4eeb157` |
| **Repo limpio post-auditoría** | Sí — sin commits, sin mutaciones. Las sondas operan sobre repos git temporales. |

### Artefactos de reproducción

| Archivo | Ubicación | Qué mide |
| :--- | :--- | :--- |
| `probe-worktree-root.mjs` | `/Users/equinox/Desktop/AOI TESTS/` | Resolución de raíz desde adentro del sandbox |
| `probe-worktree-merge-false-positive.mjs` | `/Users/equinox/Desktop/AOI TESTS/` | Falsos positivos de `merge`/`remove` |

Ambas sondas son ejecutables de forma independiente:

```bash
cd "/Users/equinox/Desktop/AOI TESTS"
node probe-worktree-root.mjs
node probe-worktree-merge-false-positive.mjs
```
