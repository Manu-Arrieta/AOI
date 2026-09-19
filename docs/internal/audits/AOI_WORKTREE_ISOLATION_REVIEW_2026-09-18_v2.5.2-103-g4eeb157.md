# Revisión técnica — Aislamiento concurrente de ciclos SDD mediante Git Worktrees

| Campo | Valor |
| --- | --- |
| **Fecha** | 2026-09-18 |
| **Versión sellada** | `v2.5.2-103-g4eeb157` |
| **Rama auditada** | `feat/sdd-worktree-isolation` |
| **Commit** | `4eeb157` — *feat(sdd): implement git worktree task isolation engine…* |
| **Estado del árbol** | limpio en el momento de la revisión |
| **Modelo auditor** | Claude Opus 5 (contexto 1M) — `claude-opus-5[1m]`, vía Claude Code |
| **Alcance** | `scripts/sdd-lifecycle/task-worktree*.mjs`, `.github/prompts/sdd-{apply,verify,archive}.prompt.md`, espejo en `scaffold/`, dashboard `agentic-ops` |
| **Método** | lectura de fuentes + ejecución real de suites y compuertas; cada afirmación de este informe está respaldada por una salida de comando citada |
| **Costo de inferencia del motor revisado** | 0 tokens (`child_process.execFile` contra `git`) |

> **Nota sobre el estado**: el plan original describe la Fase 1 como trabajo pendiente.
> No lo es. Al momento de esta revisión el motor está implementado, testeado, espejado
> en `scaffold/` y **los prompts ya están cableados**. Es decir: la ruta de pérdida de
> datos descrita en B1 no es hipotética, está activa en la rama.

---

## 1. Veredicto

**La idea es correcta. La ejecución tiene cuatro bloqueantes, y uno de ellos destruye
datos en el flujo feliz.**

Git worktree es la herramienta adecuada para el problema: un único object store
compartido, aislamiento físico real de archivos, y cero costo de inferencia porque todo
ocurre en el runtime nativo de Node contra el CLI de `git`. Nada de eso está en
discusión.

Lo que sí está en discusión es que el diseño asume un modelo de persistencia que este
repositorio no tiene. La premisa "el agente trabaja dentro del worktree y al final se
mergea" sólo funciona si lo que el agente produce es versionable. En AOI, lo que el
ciclo SDD produce —artefactos de tarea y memoria— **está explícitamente gitignoreado**.
Esa única discrepancia invalida la fase de integración completa.

**Recomendación**: no fusionar `feat/sdd-worktree-isolation` a `main` hasta resolver
B1–B4. El desvío mínimo, si se quiere conservar valor inmediato, está en la sección 7.

---

## 2. Lo que está verificado en verde

Para que la crítica sea justa, esto es lo que efectivamente funciona y fue ejecutado:

```
$ node --test scripts/sdd-lifecycle/task-worktree.test.mjs
✔ sanitizes task identifiers rejecting illegal characters
✔ determines worktree path and branch name deterministically
✔ creates an isolated worktree and links node_modules if present
✔ allows two tasks to run concurrently without file or git pollution
✔ lists active worktrees filtering only .sandboxes/
✔ merges task worktree changes into main cleanly
✔ removes the worktree and cleans directory
ℹ pass 7 · fail 0 · duration_ms 1271
```

```
$ node scripts/scaffold/validate-srp.mjs
Scanned: 238 source file(s) · limit 300 LOC
✅ No new SRP violations. 4 legacy file(s) still over the limit, none grown.
```

| Archivo | LOC | Invariante 5 (<300) |
| --- | ---: | --- |
| `scripts/sdd-lifecycle/task-worktree-ops.mjs` | 147 | ✅ |
| `scripts/sdd-lifecycle/task-worktree.mjs` | 231 | ✅ |
| `scripts/sdd-lifecycle/task-worktree.test.mjs` | 159 | ✅ |

El espejo de `scaffold/` existe para los tres archivos (Principio I satisfecho), la
separación primitivas / orquestador es limpia, y `runGit` usa `execFile` sin shell — sin
superficie de inyección por `taskId`, que además pasa por `sanitizeTaskId` con una
whitelist estricta `/^[A-Za-z0-9_-]+$/`.

**Advertencia sobre este verde**: los 7 tests corren contra un repositorio git temporal
construido por el propio test. Ese repo no reproduce las condiciones que rompen el
sistema — no tiene el `.gitignore` de AOI, no tiene `.tasks/`, no tiene `.icm/`, no tiene
el subsistema de sandboxes, y no tiene un `teardown.sh`. Por eso los 7 tests pueden estar
en verde y los cuatro bloqueantes existir simultáneamente. **El verde mide lo que el test
construyó, no lo que el sistema es.**

---

## 3. Bloqueantes

### B1 — `.tasks/*/` e `.icm/` están gitignoreados: el merge no lleva los artefactos y el `remove` los destruye

**Severidad: crítica — pérdida de datos en el camino feliz.**

Evidencia:

```
$ git check-ignore -v .tasks/foo/TASK-2026-001/spec.md .icm/x
.gitignore:31:.tasks/*/   .tasks/foo/TASK-2026-001/spec.md
.gitignore:42:.icm/       .icm/x
```

Cadena causal completa:

1. `sdd-apply.prompt.md:69` impone **Mandatory Cwd Policy**: todo el trabajo de la fase
   de implementación ocurre con `Cwd: .sandboxes/{TASK-ID}`.
2. Los artefactos SDD de la tarea —`proposal.md`, `spec.md`, `design.md`, `tasks.md`,
   `verify-report.md`— se escriben entonces en
   `.sandboxes/{TASK-ID}/.tasks/{feature}/{TASK-ID}/`.
3. Esa ruta coincide con el patrón `.tasks/*/` de `.gitignore:31`. **Git nunca los ve.**
4. `sdd-archive.prompt.md:171` ejecuta `merge {TASK-ID}`. El merge integra la rama
   `task/{TASK-ID}`, que no contiene esos archivos porque nunca fueron commiteables.
5. `sdd-archive.prompt.md:175` ejecuta `remove {TASK-ID}`, que hace
   `git worktree remove` sobre el directorio.

Resultado: **el ciclo reporta éxito y los artefactos de la tarea dejaron de existir.**
No es un edge case ni una condición de carrera: es el desenlace determinista de un
`/sdd-apply` → `/sdd-verify` → `/sdd-archive` que aprueba todas las compuertas.

> **Corrección (2026-09-18, posterior a la primera emisión).** La versión original de
> este informe extendía el argumento a `.icm/` (`.gitignore:42`), afirmando que la memoria
> ICM escrita durante la fase de implementación caía en un store distinto dentro del
> worktree. **Eso es falso y queda retractado.** Medido: la base de ICM es global —
> `~/Library/Application Support/dev.icm.icm/memories.db` — y no depende del `cwd`, de
> modo que las escrituras del agente aislado llegan al mismo store de siempre. No hay
> pérdida de memoria.
>
> Lo que sí queda en pie, y es un problema distinto del que yo describí, es que **esa
> globalidad significa que no hay aislamiento de memoria en absoluto**: una tarea
> sandboxeada escribe en el store compartido sin scoping por sandbox, contra lo que
> prescribe el protocolo ICM para entornos aislados. El defecto existe; mi diagnóstico
> del mecanismo era incorrecto.

**Confirmación empírica.** La afirmación sobre `.tasks/` no quedó en razonamiento: se
midió con `probe-worktree-artifact-loss.mjs` (en `AOI TESTS`), que reproduce el
`.gitignore` real en un repo temporal, escribe los cinco artefactos SDD dentro del
worktree junto con un archivo de código, commitea todo lo que git acepte y ejecuta el
Step 8b tal cual está prescrito:

```json
{
  "artifactsWereCommittable": false,
  "filesCarriedByTheBranch": ["feature.ts"],
  "mergeReported":  { "success": true, "mergedInto": "main" },
  "removeReported": { "success": true, "removed": true },
  "GROUND_TRUTH": {
    "sourceCodeSurvivedInRoot":   true,
    "sddArtifactsSurvivedInRoot": false,
    "worktreeDirStillOnDisk":     false
  },
  "VERDICT": { "cycleReportedSuccess": true, "sddArtifactsDestroyed": true }
}
```

El código fuente sobrevive; los cinco artefactos de la tarea no. La rama transportó un
solo archivo. El ciclo reportó éxito.

**Dato decisivo**: esta sonda corrió pasando `root` explícito, es decir **por el camino
sano**, donde los defectos de resolución de raíz descritos por la auditoría paralela no
intervienen. B1 es por lo tanto **independiente** de ellos. Ver el apéndice A.

**Agravante de coherencia.** `sdd-archive.prompt.md` Step 9 actualiza
`.tasks/registry.md` en el **root** inmediatamente después de haber destruido el
worktree en Step 8b. El registro queda apuntando a una tarea archivada cuyos artefactos
ya no existen en ningún lado. El índice sobrevive; el contenido indexado no.

**Remediación propuesta.** Es una decisión de diseño, no de código, y hay que tomarla
antes de escribir una línea:

- **Opción A — artefactos compartidos (recomendada).** `.tasks/` e `.icm/` se enlazan por
  symlink desde el worktree hacia el root, igual que `node_modules`. Se pierde el
  aislamiento de artefactos, pero ese aislamiento **no es deseable**: dos tareas
  concurrentes escriben en `.tasks/{feature}/TASK-A/` y `.tasks/{feature}/TASK-B/`, que
  son rutas disjuntas y por lo tanto no colisionan. Lo que se quiere aislar es el
  *código fuente*, no el *registro de la tarea*. Coste: bajo. Riesgo: `registry.md` es
  un archivo único que sí pueden tocar dos tareas a la vez — requiere escritura
  append-only o un lock.
- **Opción B — dejar de ignorarlos.** Cambia el contrato de versionado de todo el
  repositorio y de todo workspace instalado. Mucho más invasiva, y contradice la razón
  documentada por la que esos patrones existen. No recomendada.

Sea cual sea la elegida, hace falta un **control negativo**: un test que cree un worktree,
escriba un artefacto en `.tasks/`, ejecute `merge` + `remove`, y **falle de forma
demostrable** si el artefacto no sobrevive. Sin ese test, el arreglo no está verificado.

---

### B2 — `--target` es decorativo: el merge cae sobre `HEAD`, sea cual sea

**Severidad: crítica — corrupción de rama e informe falso.**

`scripts/sdd-lifecycle/task-worktree.mjs:118-142`:

```js
export async function mergeTaskWorktree(options) {
  const root = options.root ? canonicalPath(options.root) : resolveWorkspaceRoot()
  const targetBranch = options.targetBranch || 'main'
  // …verifica que el WORKTREE esté limpio…
  await runGit(['merge', '--no-ff', branchName, '-m', `merge: integrate ${taskId}…`], root)
  return { success: true, taskId, mergedInto: targetBranch }
}
```

Tres defectos en seis líneas:

1. **No hace `checkout` de `targetBranch`.** Ejecuta `git merge` en `root`, que integra
   sobre la rama que `HEAD` tenga en ese momento. Si el root está parado en
   `feat/lo-que-sea`, la tarea aterriza ahí.
2. **Reporta un destino que no verificó.** Devuelve `mergedInto: targetBranch` sin haber
   comprobado nada. Un consumidor determinista —un subagente, un script, el dashboard—
   que lea ese JSON recibe una afirmación falsa sin forma de detectarla. Esto es peor que
   un fallo: es un fallo que se presenta como éxito estructurado.
3. **No verifica que el árbol principal esté limpio.** Valida la limpieza del *worktree*
   (líneas 125-129) pero no la del *root*, que es donde el merge ocurre. Al iniciar esta
   revisión el root tenía 7 archivos modificados sin commitear — el merge habría corrido
   igual, mezclando trabajo en curso ajeno a la tarea.

**Remediación.** Resolver y verificar explícitamente la rama destino antes de mezclar
(`git symbolic-ref --short HEAD` comparado contra `targetBranch`, o `checkout` explícito
con restauración posterior), exigir root limpio como precondición, y no emitir
`mergedInto` sin haberlo confirmado contra el estado real posterior al merge.

---

### B3 — `.sandboxes/` ya tiene dueño, y el `teardown` lo destruye

**Severidad: alta — colisión de namespace + corrupción del registro de worktrees de git.**

`.sandboxes/` pertenece desde antes al subsistema de sandboxes multipropósito:

| Consumidor previo | Referencia |
| --- | --- |
| Esquema de manifiestos | `scripts/sandbox/manifest-schema.mjs:126` → `` const sandboxRoot = `.sandboxes/${sandbox}` `` |
| Validador CLI | `scripts/sandbox/validate-manifest.mjs:2` |
| Skill de creación | `/sandbox-new` → `.sandboxes/{name}/integration-manifest.json` |
| Plantillas versionadas | `.gitignore:34-35` → `.sandboxes/*/` ignorado, `!.sandboxes/_templates/` preservado |

La colisión es visible **dentro de un mismo archivo**. En `sdd-verify.prompt.md`
conviven las dos semánticas incompatibles:

```
:61   Si `.sandboxes/{TASK-ID}` existe, ejecutar el runner con Cwd ahí   ← worktree
:125  Si la tarea tiene un sandbox activo — un `.sandboxes/{name}/`…     ← manifiesto
:130  node scripts/sandbox/validate-manifest.mjs .sandboxes/{name}/integration-manifest.json
```

Un agente leyendo ese prompt no tiene forma de distinguir cuál de los dos ciclos de vida
gobierna un directorio dado. Un worktree de tarea no tiene `integration-manifest.json`, y
un sandbox multipropósito no es un worktree de git — pero comparten el mismo espacio de
nombres plano y la misma comprobación de existencia.

**Agravante destructivo.** `teardown.sh:89`:

```bash
remove_dir ".sandboxes"
```

Un `rm -rf` sobre un directorio que contiene worktrees vivos deja registros colgados en
`.git/worktrees/`. Git se niega a reutilizar esas rutas hasta un `git worktree prune`
explícito, de modo que una reinstalación posterior falla al crear un worktree con el
mismo `TASK-ID`. Y en un workspace instalado, el teardown se lleva puesto el árbol de
trabajo de las tareas en vuelo del Owner **sin advertirlo**: el mensaje de confirmación
(`teardown.sh:58`) anuncia "sandbox environments", no "tus tareas SDD sin integrar".

**Remediación.** Separar el namespace —`.worktrees/{TASK-ID}` o
`.sandboxes/_tasks/{TASK-ID}`—, actualizar `parseWorktreeList` (que hoy filtra por el
prefijo literal `.sandboxes/`, `task-worktree-ops.mjs:131`), y hacer que `teardown.sh`
ejecute `git worktree prune` **antes** de borrar, además de enumerar los worktrees vivos
en el prompt de confirmación.

---

### B4 — `/sdd-archive` automatiza commits a `main`, contra una regla vigente del Owner

**Severidad: alta — violación de una instrucción permanente.**

`sdd-archive.prompt.md:167-176` declara el bloque *Step 8b* de forma **incondicional**:
si `.sandboxes/{TASK-ID}` existe, se mergea a `main` y se desmantela. `git merge --no-ff`
crea un commit de merge. Por lo tanto la fase de archivado **commitea a `main` sin
intervención humana**.

Hay una instrucción permanente registrada en ICM en sentido contrario: no commitear a
`main`; el trabajo va a rama y la integración la autoriza el Owner. Automatizar la
integración dentro de una fase del ciclo convierte esa regla en algo que depende de que
nadie ejecute `/sdd-archive`.

**Remediación.** La integración tiene que ser **opt-in explícito** —bandera
`--integrate`, o una confirmación del Owner en la propia fase—, y el default debe dejar
la rama `task/{TASK-ID}` intacta y reportar la ruta de integración sugerida. El
desmantelamiento del worktree (`remove`) **nunca** debe ejecutarse automáticamente
mientras B1 siga abierto: hoy es el paso que borra los artefactos.

---

## 4. Defectos graves (no bloqueantes, pero invalidan promesas del plan)

### G1 — `linkDependencies` enlaza el `node_modules` que no sirve y omite el que sí

`task-worktree-ops.mjs:82-95` enlaza únicamente `{root}/node_modules`. Pero la raíz de
este repositorio **no declara dependencias**:

```yaml
# pnpm-workspace.yaml
packages: []
```

El comentario del propio archivo lo explica: la raíz es un ejecutor de scripts, y el
dashboard posee su propio workspace bajo `aoi_apps/`. Los `node_modules` reales son:

```
./node_modules/                                  ← enlazado, prácticamente vacío de valor
./aoi_apps/node_modules/                         ← NO enlazado
./aoi_apps/agentic-ops-dashboard/node_modules/   ← NO enlazado
```

Consecuencia: la promesa de **"arranque <500 ms sin `pnpm install`"** no se cumple
justamente para la suite que la Fase 3 del plan quiere ejecutar
(`pnpm --dir aoi_apps/agentic-ops-dashboard test`). Dentro de un worktree, esa suite o
falla por módulos no resueltos o dispara una instalación completa.

**Remediación.** Enlazar recursivamente todo `node_modules` de los paquetes del
workspace, o —más simple y más determinista— enlazar por lista explícita derivada de los
directorios que contienen un `package.json`.

### G2 — `resolveWorkspaceRoot` anida worktrees dentro de worktrees

`task-worktree-ops.mjs:31-39` sube directorios hasta encontrar `.git` con
`fs.existsSync`. Dentro de un worktree, `.git` **es un archivo**, no un directorio, y
`existsSync` devuelve `true` igual. Por lo tanto, ejecutar `create TASK-B` con el `cwd`
dentro del worktree de TASK-A produce:

```
.sandboxes/TASK-A/.sandboxes/TASK-B
```

Esto es exactamente lo que va a pasar, porque `sdd-apply.prompt.md:69` **obliga** al
agente a operar con `Cwd: .sandboxes/{TASK-ID}`. El escenario de anidamiento no es
rebuscado: es el escenario normal de un agente que encadena tareas.

**Remediación.** Resolver la raíz con `git rev-parse --path-format=absolute
--git-common-dir` y derivar de ahí el árbol principal, en lugar de caminar el árbol de
directorios a mano.

### G3 — El workspace instalado puede no ser un repositorio git, o no tener `HEAD`

AOI se instala **dentro del proyecto del Owner**. El motor asume tres cosas que ese
proyecto puede no cumplir:

1. Que es un repositorio git. Si no lo es, `resolveWorkspaceRoot` cae en el fallback
   (`canonicalPath(startDir)`) y `git worktree add` falla con un error crudo del CLI, sin
   camino de degradación declarado en ningún prompt.
2. Que tiene al menos un commit. `git worktree add -b` necesita un `HEAD` válido; un
   repo recién inicializado no lo tiene.
3. Que la rama por defecto se llama `main` (`task-worktree.mjs:122`). `master`, `trunk` o
   `develop` rompen el default silenciosamente — y por B2, sin siquiera reportarlo.

Hay además una cuestión que excede lo técnico: **crear ramas `task/*` en el repositorio
de otra persona es mutar su namespace de control de versiones.** El plan no lo declara
como efecto de la instalación ni pide autorización para hacerlo.

**Remediación.** Detectar las tres precondiciones antes de intentar nada, degradar
explícitamente a modo sin aislamiento cuando falten (con mensaje claro, no con un stack
trace de git), y resolver la rama base desde `git symbolic-ref refs/remotes/origin/HEAD`
o el default configurado, nunca desde una constante.

---

## 5. Observaciones menores

- **El plan describe como pendiente trabajo ya hecho.** La Fase 1 completa —
  modularización, canonicalización `realpath`, 7/7 tests, SRP— está en `4eeb157`. Un plan
  escrito desde un snapshot desactualizado hace que la revisión se enfoque donde no hay
  riesgo y deje sin mirar donde sí lo hay.
- **El plan fija `<200 LOC` por archivo.** El invariante real es 300 y el ratchet lo
  verifica. Inventar un límite más estricto sin motivo medido agrega fricción sin agregar
  garantía.
- **El badge del dashboard (Fase 3) es scope creep.** Cero beneficio en economía de
  tokens y agrega lectura de estado de git a cada construcción de snapshot. Es
  observabilidad legítima, pero no pertenece al mismo cambio que un motor de integración
  que todavía borra artefactos. Diferir.
- **Diagrama Mermaid del plan**: correcto en la topología, pero omite `.tasks/`, `.icm/`
  y el `teardown`, que son precisamente las tres aristas donde el diseño falla. Un
  diagrama que no muestra los flujos de datos no versionados oculta el problema real.

---

## 6. Pregunta abierta que el plan nunca se hace

**¿El ciclo SDD corre concurrente hoy, en la práctica?**

El plan justifica toda la infraestructura con la colisión entre `TASK-2026-001` y
`TASK-2026-002` ejecutándose en paralelo. Nadie midió si eso ocurre. Si el patrón real es
un ciclo por sesión, esto es un seguro de correctitud pagado con una superficie de ciclo
de vida entera —cuatro comandos nuevos, tres prompts modificados, un namespace en
disputa y un camino de integración automatizado.

Aplica YAGNI hasta que exista la medición. Y si la colisión existe y está medida, **el
plan se justifica solo con ese número** — que es un argumento mucho más fuerte que la
hipótesis con la que hoy se lo defiende.

---

## 7. Orden de trabajo recomendado

El plan original ejecuta en el orden 1→2→3→4. **Ese orden es el peligroso**: su Fase 2
—cablear los prompts— es precisamente la que activa la ruta de pérdida de datos de B1 en
cada workspace instalado, y ya está ejecutada en la rama.

| # | Acción | Cierra |
| --- | --- | --- |
| 0 | **Desactivar el cableado de prompts** hasta que B1 esté resuelto: quitar Step 8b de `sdd-archive` y la Mandatory Cwd Policy de `sdd-apply`. El motor puede quedar disponible como CLI manual sin riesgo. | contención |
| 1 | Decidir y aplicar el contrato de artefactos: symlink de `.tasks/` e `.icm/` (Opción A), con test de control negativo que falle si un artefacto no sobrevive al ciclo `merge`+`remove`. | B1 |
| 2 | Arreglar `merge`: checkout/verificación explícita del destino, root limpio como precondición, `mergedInto` confirmado contra el estado real. | B2 |
| 3 | Mover el namespace fuera de `.sandboxes/`, actualizar el filtro de `parseWorktreeList` y enseñarle a `teardown.sh` a podar y a advertir. | B3 |
| 4 | Poner la integración detrás de bandera explícita; `remove` nunca automático. | B4 |
| 5 | Enlazado recursivo de `node_modules`; raíz vía `--git-common-dir`; precondiciones de repo/HEAD/rama base con degradación declarada. | G1–G3 |
| 6 | Recién ahora: recablear los prompts. | — |
| 7 | Diferido, cambio aparte: observabilidad en el dashboard. | — |

Cada paso va en su propia rama con su propio commit, y se integran en la misma pasada.

---

## 8. Plan de verificación

Ninguna de estas comprobaciones vale sin su control negativo — un caso que **falle de
forma demostrable** antes del arreglo. Un test que sólo pasa después no prueba que esté
midiendo algo.

```bash
# Motor
node --test scripts/sdd-lifecycle/task-worktree.test.mjs

# Invariante 5 (ratchet)
node scripts/scaffold/validate-srp.mjs

# Paridad con scaffold (Principio I)
pnpm test:parity

# Alcanzabilidad: ningún fuente sin test que lo cargue
pnpm aoi:reachability

# Suite del dashboard
pnpm --dir aoi_apps/agentic-ops-dashboard test

# Salud global, 0 tokens
pnpm aoi:doctor

# La cadena completa, que es el contrato bajo el que este repo shippea
pnpm test
```

Controles negativos exigidos, uno por bloqueante:

| Bloqueante | Control negativo que debe fallar antes del arreglo |
| --- | --- |
| B1 | Crear worktree → escribir `.tasks/{f}/{ID}/spec.md` → `merge` → `remove` → aseverar que el archivo existe en el root. |
| B2 | Parar el root en una rama distinta de `main` → `merge --target main` → aseverar que `main` avanzó y la otra rama no. |
| B3 | Crear worktree → simular `teardown` → aseverar que `git worktree list` no deja entradas colgadas. |
| B4 | Ejecutar la fase de archivado sin bandera → aseverar que `main` **no** tiene commits nuevos. |

Y por encima de todo: nada de esto está verificado hasta que corra el protocolo completo
en una instalación real en `AOI TESTS`, incluida la suite de estrés de tokens
(`pnpm aoi:stress-sdd`), comparando el ahorro por fase contra la línea base del ciclo
anterior. Las suites de este repositorio leen el instalador como texto; ninguna lo
ejecuta.

---

## Apéndice A — Contraste con la auditoría paralela y el defecto de interacción

Existe una segunda revisión del mismo commit,
[`AOI_WORKTREE_ISOLATION_PLAN_REVIEW_2026-09-18.md`](AOI_WORKTREE_ISOLATION_PLAN_REVIEW_2026-09-18.md),
producida por **Deepseek v4 flash vía GitHub Copilot**. Reproduje sus dos sondas
(`probe-worktree-root.mjs`, `probe-worktree-merge-false-positive.mjs`) contra este mismo
árbol: **sus hallazgos D1 y D2 son reales y están correctamente medidos.**

### A.1 Lo que esa auditoría encontró y esta no

| ID suyo | Defecto | Estado en este informe |
| --- | --- | --- |
| D1+D2 encadenados | Con `cwd` dentro del sandbox, la raíz resuelve al propio sandbox; `merge` corre parado en `task/*`, git responde *Already up to date*, y `merge`/`remove` devuelven `success: true` sin haber tocado nada | Yo reporté el anidamiento como **G2 (grave)** y el destino equivocado como **B2**, por separado. **La cadena entre ambos —el falso positivo silencioso— no la vi, y es la severidad correcta.** |
| D7 | `const baseBranch = options.baseBranch \|\| 'HEAD'` — una tarea creada sin `--base` nace de la rama de feature actual, no de `main` | **No lo encontré.** Verificado en `task-worktree.mjs:62`. Footgun vivo. |
| D8 | Los 7 tests pasan `root: tmpRepo` explícito; **ninguno cambia el `cwd`**, que es justo el modo que el prompt prescribe | Yo dije que el repo temporal "no reproduce las condiciones". Su diagnóstico es mecánicamente exacto y el mío genérico. |
| D10 | Dos agentes sobre el mismo `TASK-ID` reciben `reused: true` y escriben el mismo árbol: la colisión que el plan dice resolver, un nivel más abajo | **No lo encontré.** |
| 5.1 | Los worktrees **empeoran** la concurrencia sobre `.tasks/registry.md` (trackeado): antes el filesystem serializaba, ahora dos ramas divergen y conflictúan en el merge | **No lo encontré.** Observación arquitectónica correcta. |
| D11 | Aislamiento de ICM y de `.specify/memory/versions/active.json`: ambos globales, fuera del worktree | Correcto, y **corrige un error de este informe** (ver el recuadro en B1). |

### A.2 Lo que este informe encontró y esa auditoría no

| ID | Defecto | Ausente allí |
| --- | --- | --- |
| **B1** | `.tasks/*/` gitignoreado ⇒ los artefactos SDD no son commiteables, el merge no los transporta y el `remove` los destruye | Esa revisión toca `.tasks/registry.md` como punto de conflicto de merge (5.1) pero **nunca conecta la ruta ignorada con la pérdida de los artefactos de tarea**. |
| B3 (parcial) | `rm -rf` sobre worktrees vivos deja registros colgados en `.git/worktrees/`, que bloquean recrear el mismo path sin `git worktree prune` | Su D5 detecta la destrucción, no la corrupción del registro de git. |
| G3 | El workspace instalado puede no ser repo git, no tener `HEAD`, o no llamarse `main` su rama por defecto — y crear ramas `task/*` **muta el namespace de VCS del Owner** sin declararlo | Su D7 cubre el nombre de la rama; el resto no aparece. |
| §6 | ¿La concurrencia que justifica todo esto está medida? | No se plantea. |

### A.3 El defecto de interacción: ninguna de las dos auditorías lo dice

Hoy, bajo el modo que el prompt prescribe (`cwd` dentro del sandbox), `remove` **también**
es un no-op: reporta `removed: true` y el directorio sigue en disco. Es decir que los dos
defectos críticos de la otra auditoría están **accidentalmente protegiendo** a B1: los
artefactos sobreviven, huérfanos, dentro de un sandbox que nadie borró.

De ahí se sigue una consecuencia que hay que decir en voz alta:

> **Aplicar R1 y R2 de esa auditoría sin arreglar antes B1 convierte una pérdida de datos
> latente en una pérdida de datos efectiva.** Al hacer que `remove` funcione de verdad, el
> ciclo empieza a borrar realmente los artefactos que hoy quedan olvidados en disco.

Por eso el orden de la sección 7 de este informe no es intercambiable con el de la
sección 6 de aquel. La secuencia segura es: **contener el cableado → B1 → R1/R2 → el
resto.** Arreglar primero la resolución de raíz es lo intuitivo y es lo peligroso.

### A.4 Sondas de reproducción

| Archivo | Ubicación | Autor | Qué mide |
| --- | --- | --- | --- |
| `probe-worktree-root.mjs` | `AOI TESTS/` | Deepseek v4 flash | Resolución de raíz desde dentro del sandbox |
| `probe-worktree-merge-false-positive.mjs` | `AOI TESTS/` | Deepseek v4 flash | Falsos positivos de `merge`/`remove` |
| `probe-worktree-artifact-loss.mjs` | `AOI TESTS/` | Claude Opus 5 (1M) | Supervivencia de los artefactos SDD al ciclo `merge`+`remove` |

---

## Apéndice B — Decisión final: rollback

**El motor fue revertido el 2026-09-18 por decisión del Owner.** No se arregló ninguno de
los defectos de este informe, porque la pregunta que los volvía relevantes se respondió
en sentido negativo.

### El motivo: medición de economía de tokens

El Owner pidió medir si el aislamiento por worktrees producía ahorro de tokens, que es el
propósito permanente de AOI. La medición:

| Concepto | Costo / ahorro medido |
| --- | --- |
| Prosa agregada a los tres prompts | 26 líneas · 1191 bytes · **~330 tokens**, y solo al invocarse la fase (los `*.prompt.md` se cargan por comando, no como `.github/instructions/` con `applyTo: "**"`) |
| Motor `task-worktree*.mjs` | **0 tokens de inferencia** — `execFile` contra `git` |
| Observabilidad en el dashboard | **0 tokens de inferencia** |
| **Ahorro producido** | **Ninguno** |

La conclusión es que el motor está **bien construido desde la economía de tokens** —la
lógica vive en scripts deterministas, no en prosa que el modelo relee— pero **no ahorra
nada**. Es una función de correctitud que previene retrabajo, no un mecanismo de ahorro.
Bajo el principio rector de AOI, eso no alcanza para conservar la superficie.

A eso se suma que la premisa nunca se midió: `.tasks/` contiene **un solo archivo**,
`registry.md`, sin ninguna carpeta de tarea. La colisión concurrente que justificaba toda
la infraestructura no está demostrada.

### Qué se revirtió y cómo

El rollback resultó trivial porque toda la implementación era **un solo commit sin
integrar**:

```
feat/sdd-worktree-isolation  4eeb157   ← toda la implementación, 22 archivos, +1228 líneas
main                         3e3fad3   ← nunca contuvo nada del motor
```

Verificado tras volver a `main`: cero archivos `task-worktree*`, cero referencias al motor
en `.github/prompts/`, ningún worktree registrado, ninguna rama `task/*`, y `.sandboxes/`
con su contenido original (`_templates/` + `registry.md`).

**La rama `feat/sdd-worktree-isolation` se conserva deliberadamente.** Este informe y el
paralelo están sellados contra `4eeb157`; borrar la rama volvería irreproducibles sus
mediciones.

### El efecto secundario que la compuerta de prosa detectó

Al volver a `main`, `aoi:lint-refs` pasó a rojo, y con él el control negativo de
`test:parity` —que exige todas las compuertas en verde sobre la copia intacta antes de
inyectar una violación—. La causa: el informe paralelo citaba comandos en forma de
invocación viva —el runner seguido de la ruta `scripts/sdd-lifecycle/task-worktree.mjs`—
apuntando a un script que ya no existe.

La compuerta tenía razón: prosa que le indica a un agente ejecutar un script inexistente
es una trampa. Se resolvió **en el documento, no debilitando la compuerta** — las nueve
invocaciones se reescribieron sin el runner `node`, de modo que queden como cita
histórica y no como comando copiable. Exceptuar `docs/internal/audits/` del linter habría
creado exactamente el punto ciego que otras compuertas de AOI ya pagaron caro.

### Lo que sobrevive del trabajo

- Los dos informes de auditoría, como registro de por qué se descartó.
- Tres sondas reproducibles en `AOI TESTS` (apéndice A.4), que siguen siendo válidas si
  alguna vez se retoma el aislamiento por worktrees.
- La medición de economía, que es la que cierra el caso.

---

*Informe sellado contra `v2.5.2-103-g4eeb157`, producido por Claude Opus 5 (contexto 1M,
`claude-opus-5[1m]`) vía Claude Code el 2026-09-18. Los arreglos derivados van en ramas
separadas de la rama auditada.*
