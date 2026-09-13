# Protocolo de Auditoría Comparativa de AOI

**Versión del Protocolo:** `v2.4.0`  
**Fecha de Vigencia:** 2026-09-12  
**Estado:** Estándar Canónico Operativo de Auditoría Multi-Harness  
**Última Modificación por:** GitHub Copilot (DeepSeek v4 Flash) — meta-auditoría de `v2.2.0-66` → `v2.3.0`  

> ### 🔏 Firma y resumen del ciclo `v2.4.0`
>
> | | |
> | :--- | :--- |
> | **Auditor** | **GitHub Copilot** · modelo **DeepSeek v4 Flash** (provider DeepSeek) |
> | **Fecha** | 2026-09-12 |
> | **Extremos auditados** | `v2.2.0-66-gf4ca363` → `v2.3.0` (`f78888e`), 3 commits, diff de sólo `docs/` |
> | **Dónde se probó** | Repositorio **+ instalación real** en `AOI TESTS` (Fase 13) |
> | **Informe** | **[`AOI_AUDIT_2026-09-12_v2.2.0-66_vs_v2.3.0.md`](AOI_AUDIT_2026-09-12_v2.2.0-66_vs_v2.3.0.md)** |
>
> **Resumen.** Meta-auditoría del protocolo contra el sistema que describe. La comparación de
> tokens es **degenerada** — los dos extremos sólo difieren en `docs/`, que ningún instrumento
> de costo mide — así que el titular no es un ahorro sino la auditoría del protocolo mismo:
> **11 hallazgos del protocolo** (4 con control negativo reproducible) y **3 del sistema**.
>
> **Qué cambió.** 1 compuerta nueva (`aoi:audit-protocol`, cableada en `pnpm test`), 1 módulo
> nuevo (`scripts/scaffold/failure-injection.mjs`), 4 reglas nuevas de procedimiento (2.0,
> 2.0.1, 14.3.1, 14.3.2) y 3 trampas nuevas de instrumental (A.11, A.12, A.13).
>
> **El piso no se movió: 86.873 tokens**, idéntico al repositorio y a los dos ciclos anteriores.
> Huella de masa repetida `8e7b013002e23b4a`, también idéntica.

### Control de Versiones (Changelog)

| Versión | Fecha | Agente / Modelo | Cambios Principales |
| :--- | :--- | :--- | :--- |
| `v2.4.0` | 2026-09-12 | GitHub Copilot (DeepSeek v4 Flash) | Arregla A.11 (el `\|\|` que re-ejecutaba toda roja), incorpora `pnpm aoi:mutation` a la Fase 8, mide la masa que ningún instrumento contaba (§6.5), fija 2.0 / 2.0.1 / 14.3.1 / 14.3.2, agrega `aoi:audit-protocol` y la Fase 15. → **[informe completo](AOI_AUDIT_2026-09-12_v2.2.0-66_vs_v2.3.0.md)** |
| `v2.3.0` | 2026-09-12 | Gemini 3.8 Flash (Antigravity) | Portabilidad POSIX universal (`cmp -s` en vez de `md5`, fallback para `timeout` y `fd`), adición de la sección A.10, robustez en `wiring.mjs` con exclusión de `.git/.tasks/.resources`, indexación canónica en `docs/README.md` y certificación de 25/25 sondas conductuales. |
| `v2.2.0` | 2026-09-11 | Claude 3.5 Sonnet / Multi-Harness | Redacción inicial del protocolo tras la auditoría comparativa `v2.1.0-12` vs `v2.2.0-53`; formalización de la descomposición de cuatro términos, banda $\times 6$ y compuertas de falso verde. |

---

**Qué es.** El procedimiento completo para auditar una versión de AOI contra otra en
rendimiento, funcionamiento entre componentes, uso de herramientas, ahorro de tokens y
comportamiento del ciclo SDD. Está escrito para que lo ejecute un agente autónomo en
**cualquier harness** — Antigravity, GitHub Copilot, Claude Code o Cursor — sin depender de
ninguna capacidad propia de uno solo.

**Para quién.** Para vos, agente, que vas a ejecutarlo. Leelo entero antes de correr el
primer comando: el orden importa y varios pasos existen para evitar errores que ya se
cometieron.

**Cuánto cuesta.** Casi nada de inferencia. El 90% de este protocolo es aritmética
determinista sobre archivos en disco. Si te encontrás razonando sobre tokens en vez de
medirlos, retrocedé: hay un comando para eso.

**Numeración, y esto confunde a propósito de nadie.** Los encabezados numeran la SECCIÓN
(`## 3. Fase 2`); el texto, el checklist y las referencias cruzadas nombran la FASE. La
sección $N$ describe la fase $N-1$. El mapa de abajo es la traducción, y es lo único que hay
que mirar para orientarse:

| Fase | Sección | Qué decide |
| :--- | :--- | :--- |
| 0 | §1 | Identificar exactamente qué se compara |
| 1 | §2 | Árboles aislados |
| 2 | §3 | Costo fijo: piso y techo |
| 3 | §4 | La descomposición de cuatro términos |
| 4 | §5 | ¿El ahorro es real o es contabilidad? |
| 5 | §6 | La banda $\times 6$ y la masa en disco |
| 6 | §7 | Payload variable |
| 7 | §8 | Instrumentación, compuertas y tests |
| 8 | §9 | Falso verde |
| 9 | §10 | Herramientas obligatorias |
| 10 | §11 | Cableado |
| 11 | §12 | Prueba de equivalencia por cada recorte |
| 12 | §13 | Ciclo de vida, Invariant Gate y sondas |
| 13 | §14 | La corrida real sobre una instalación |
| 14 | §15 | Redacción del informe |
| 15 | §16 | Arreglos + el protocolo se audita a sí mismo |

---

## 0. La regla que gobierna todo el protocolo

> **Un número que no se puede reproducir con un comando no entra en el informe.**

De ahí salen cuatro reglas operativas que no son negociables:

1. **Medí las dos versiones con EL MISMO instrumento**, el de la versión nueva. Medir cada
   versión con su propio medidor mezcla *ahorro real* con *corrección de medición*, y el
   resultado es un número verdadero que describe algo que no es.
2. **Separá el recorte del cambio contable.** Una caída del piso puede venir de prosa
   borrada o de prosa reclasificada. Las dos son legítimas, pero sólo una es ahorro.
3. **Verificá antes de afirmar.** Si tu conclusión se apoya en la salida de `rg`, `grep` o
   cualquier herramienta proxy, confirmala con un segundo método antes de escribirla. El
   Apéndice A lista los casos donde eso ya falló.
4. **El protocolo también es una superficie, y también deriva.** Nombra rutas, símbolos,
   banderas y una versión, y nada de eso lo ejecuta nadie: un renombre lo pudre en silencio.
   Por eso existe una compuerta — `aoi:audit-protocol` — y por eso el **paso 0 de cualquier
   auditoría es correrla antes de tocar nada**:

   ```bash
   node scripts/multi-harness/audit-protocol-integrity.mjs
   ```

   Si sale distinto de cero, **el protocolo que estás a punto de ejecutar describe un sistema
   que ya no existe**. Arreglá el protocolo primero o reportá el hallazgo; no construyas un
   número encima de una instrucción rota.

---

## 1. Fase 0 — Identificar exactamente qué se compara

### 1.1 Resolver ambos extremos con `git describe`

**No uses el tag a secas.** En este repositorio los tags no identifican lo que uno cree:
el tag `v2.1.0` apunta a `e6691bb`, mientras que el commit cuyo mensaje declara v2.1.0 es
`28cb265`, doce commits después. Un informe rotulado «v2.1.0» es irreproducible.

```bash
cd "<RUTA_DEL_REPO_AOI>"

BASE="<sha-de-la-version-vieja>"
HEAD_SHA="$(git rev-parse HEAD)"

# Identidad sin ambigüedad de ambos extremos
git describe --tags "$BASE"        # p.ej. v2.1.0-12-g28cb265
git describe --tags "$HEAD_SHA"    # p.ej. v2.2.0-53-g2abdaee

# Confirmar que los SHA son los que creés
git show -s --format='%H | %ad | %s' "$BASE"
git show -s --format='%H | %ad | %s' "$HEAD_SHA"

# Magnitud del salto
git rev-list --count "$BASE".."$HEAD_SHA"
git diff --stat "$BASE".."$HEAD_SHA" | tail -3
```

> [!WARNING]
> **Usá `git show -s`, no `git log -1 <sha>`.** Con el proxy RTK activo, `git log -1 <sha>`
> devolvió el commit **padre** en vez del pedido. Es un error silencioso que envenena toda la
> auditoría desde el primer paso. Si los dos comandos discrepan, creele a `git show -s` y
> anotá la discrepancia como hallazgo del instrumental.

### 1.2 Anotar los dos sellos

Escribí los dos `git describe` en un archivo de notas antes de seguir. Todo el informe se
rotula con ellos. Sin eso, la corrida no se puede comparar contra ninguna otra.

---

## 2. Fase 1 — Árboles aislados

Necesitás las dos versiones en disco simultáneamente. **No cambies de rama**: eso destruye
el estado de trabajo y hace imposible medir en paralelo.

### 2.0 Dónde vive cada cosa — y esto NO es negociable

Hay dos ubicaciones canónicas y una prohibida. Escribilas una vez al principio y usá siempre
las variables:

| Variable | Ubicación canónica | Qué guarda |
| :--- | :--- | :--- |
| `$WORK` | `$HOME/.aoi-audit-work/<YYYY-MM-DD>-<describe-base>_vs_<describe-head>/` | Worktrees y los scripts auxiliares |
| `$TESTS` | `/Users/equinox/Desktop/AOI TESTS` | El workspace de pruebas instalado (Fase 13) |
| — | `~/Desktop/` a secas | **PROHIBIDO.** |

> [!CAUTION]
> **No escribas nada suelto en el Escritorio.** Ni el `$WORK`, ni los scripts auxiliares, ni
> copias descartables. El Escritorio es del Owner y no es un directorio de trabajo: un
> `$WORK` ahí deja cinco archivos y dos worktrees tirados en su vista, y el próximo que abra
> la carpeta no sabe si son basura o parte de una auditoría en curso. Usá `$HOME/.aoi-audit-work/`,
> que es un directorio oculto, fuera del repo, y sobrevive un reinicio.
>
> Las copias descartables de inyección de fallas van donde diga `mkdtemp` —`$TMPDIR`, no el
> Escritorio— y se borran en el `after()`.

#### 2.0.1 Qué se queda en `$TESTS` y qué vuelve al repositorio

**`AOI TESTS` es el hogar de todo el ciclo de pruebas y de todo lo que el ciclo produce.** Se
queda ahí, y no es una omisión a corregir:

- las tareas SDD (`.tasks/**`) y sus artefactos — spec, design, tasks, payloads, archive-report;
- los contratos BIC y su registro ICM bajo la entidad del workspace;
- el código de los entregables y sus tests;
- el registro de tareas, el estado instalado y las corridas.

**Lo único que vuelve al repositorio de desarrollo son las mejoras a la auditoría y sus
resultados**, para poder compararlos en el tiempo:

- el protocolo y sus instrumentos (gates, scripts, tests);
- los informes de auditoría (`docs/internal/audits/`);
- la línea base en `AOI_REAL_WORLD_VERIFICATION_MATRIX.md` §5.0.

> [!IMPORTANT]
> Esto convierte al paso 14.3.1 en **esperado, no en alarma**. Un `+ X` en el diff de
> conjuntos es la **firma normal** de que `$TESTS` acumuló un ciclo real que el repositorio no
> tiene — y así se reporta: *"diferencia esperada por diseño: `$TESTS` es el hogar del ciclo"*,
> con los archivos nombrados. Lo que **sí** es un hallazgo es un `- X`: que el repositorio
> tenga un archivo gobernado que la instalación no recibió, porque eso es un defecto del
> instalador.
>
> Y sigue siendo un hallazgo que un ciclo **cerrado** cuyos entregables nunca se promovieron
> quede sin dueño declarado. La regla no es "no mires la diferencia": es "sabé cuál diferencia
> es esperada y cuál no".

```bash
BASE_SLUG="$(git describe --tags "$BASE")"
HEAD_SLUG="$(git describe --tags "$HEAD_SHA")"
WORK="$HOME/.aoi-audit-work/${BASE_SLUG}_vs_${HEAD_SLUG}"
mkdir -p "$WORK"

# Un `git worktree add` sobre una ruta que ya existe FALLA. Si estás retomando una
# auditoría interrumpida, los árboles ya están: no los recrees a ciegas.
for t in base head; do
  if [ -e "$WORK/$t/.git" ]; then echo "$t ya existe: se reutiliza"; fi
done

git worktree add --detach "$WORK/base" "$BASE"
git worktree add --detach "$WORK/head" "$HEAD_SHA"
git worktree list
```

Al terminar, el `$WORK` se limpia **entero** — worktrees, scripts y todo:

```bash
git worktree remove --force "$WORK/base"
git worktree remove --force "$WORK/head"
git worktree prune
rm -rf "$WORK"
```

### 2.1 Verificar que los árboles son los que creés

Un worktree recreado de memoria, o uno que sobrevivió a un `git fetch` de otra sesión, puede
no estar en el SHA que dice el informe. Y el paso 1.1 ya enseñó que este repositorio tiene
formas de devolverte un commit que no pediste. Confirmá los dos extremos **desde adentro de
cada árbol** antes de medir nada:

```bash
for t in base head; do
  printf "%-5s %s\n" "$t" "$(git -C "$WORK/$t" rev-parse HEAD)"
done
# Debe imprimir exactamente $BASE y $HEAD_SHA, en ese orden.
```

> [!CAUTION]
> Si los dos SHA no coinciden con los del paso 1.2, **tirá los árboles y recrealos**. Una
> auditoría rótulada con un sello que el disco no respalda es irreproducible, y el trabajo
> de medirla también.

### 2.2 Registrar la procedencia del instrumento

El protocolo mide los dos árboles con el instrumento del árbol **nuevo**. Ese instrumento es
código, y el código cambia: un `cache-prefix.mjs` que devuelve otra forma, o un
`auditContextBudget` que dejó de contar una categoría, produce números que describen al
instrumento y no al árbol.

Antes de la Fase 2, anotá el SHA del instrumento y comprobá que los snippets de las
secciones 3.1 y 4.1 siguen corriendo **sin excepciones**:

```bash
git -C "$WORK/head" rev-parse HEAD -- scripts/sdd-lifecycle/context-budget.mjs \
  scripts/sdd-lifecycle/cache-prefix.mjs

# Los dos snippets tienen que imprimir una tabla. Una excepción acá NO es un
# hallazgo sobre las versiones: es un hallazgo sobre el instrumental, y va al
# informe con esa etiqueta.
node "$WORK/compare-budget.mjs" "$WORK/base" "$WORK/head" >/dev/null && echo "comparador OK"
node "$WORK/decompose.mjs" "$WORK/base" "$WORK/head" >/dev/null && echo "descompositor OK"
```

Si el instrumento nuevo no puede leer el árbol viejo (cambió una forma de retorno, se movió
una ruta), eso es **`instrumento`**, no `datos`. Reportalo así y no sigas: el delta que
calcules con un instrumento que falla a medias no significa nada.

> [!IMPORTANT]
> El `$WORK` de 2.0 —`$HOME/.aoi-audit-work/…`— ya **sobrevive a un reinicio de sesión**,
> que es lo que este paso necesita. No lo muevas al Escritorio para "tenerlo a mano": ver 2.0.
> Si un directorio temporal del harness se vacía a mitad de la auditoría, recreá los árboles
> con los mismos SHA: los sellos del paso 1.2 son justamente para eso.

---

## 3. Fase 2 — Costo fijo: piso y techo

El **piso** es lo que cuesta un ciclo SDD antes de hacer nada: la prosa que el harness carga
sí o sí. El **techo** agrega lo que cuesta si además dispara toda rama condicional.

### 3.1 El comparador

Guardá esto como `$WORK/compare-budget.mjs`. Importa el instrumento **de la versión nueva**
y lo apunta contra los dos árboles.

```javascript
// Corre el instrumento ACTUAL contra dos árboles. Única comparación honesta.
import { auditContextBudget } from '<RUTA_DEL_REPO_AOI>/scripts/sdd-lifecycle/context-budget.mjs'

const run = (root, label) => ({ label, ...auditContextBudget(root) })
const base = run(process.argv[2], 'base')
const head = run(process.argv[3], 'head')

const map = (b) => Object.fromEntries(b.rows.map((r) => [r.phase, r]))
const mb = map(base), mh = map(head)
const phases = [...new Set([...Object.keys(mb), ...Object.keys(mh)])]

console.log('\n=== PISO Y TECHO POR FASE ===')
console.table(phases.map((p) => {
  const a = mb[p] || {}, c = mh[p] || {}
  return {
    Fase: p,
    'Piso base': a.floor ?? '—', 'Piso head': c.floor ?? '—',
    'Delta': (a.floor && c.floor) ? c.floor - a.floor : '—',
    '%': (a.floor && c.floor) ? (((c.floor - a.floor) / a.floor) * 100).toFixed(1) + '%' : '—',
    'Techo base': a.total ?? '—', 'Techo head': c.total ?? '—',
  }
}))

console.log('\n=== POR CATEGORÍA (suma de las 6 fases) ===')
const sum = (b, c) => b.rows.reduce((n, r) => n + (r[c] || 0), 0)
console.table(['prompt','agents','speckit','instructions','skills','conditional'].map((c) => ({
  Categoria: c, base: sum(base, c), head: sum(head, c),
  Delta: sum(head, c) - sum(base, c),
})))

console.log('\n=== TOTALES ===')
console.table([
  { M: 'PISO',  base: base.floor, head: head.floor, Delta: head.floor - base.floor },
  { M: 'TECHO', base: base.total, head: head.total, Delta: head.total - base.total },
  { M: 'Margen condicional', base: base.total - base.floor, head: head.total - head.floor,
    Delta: (head.total - head.floor) - (base.total - base.floor) },
])
```

```bash
node "$WORK/compare-budget.mjs" "$WORK/base" "$WORK/head"
```

### 3.2 Qué mirar

- **Si el margen condicional creció mucho**, no celebres todavía la caída del piso. Parte de
  esa caída puede ser reclasificación. La Fase 3 lo resuelve.
- **Si alguna fase tiene el techo más alto que antes**, anotá cuál: concentró trabajo
  condicional que antes se cobraba al piso.

---

## 4. Fase 3 — La descomposición de cuatro términos

**Este es el paso central de toda la auditoría.** Sin él, el titular es un número sin
significado.

Cada archivo del piso tiene dos propiedades: cuántos tokens pesa (`t`) y en cuántas fases se
carga (`m`). La caída del piso se descompone en efectos que **suman exactamente el total, sin
residuo**:

```
t_H·m_H − t_B·m_B  =  m_B·(t_H−t_B)  +  t_H·(m_H−m_B)   ± entradas y salidas del grafo
                      ─────────────     ─────────────
                       [A] prosa         [B] multiplicidad
```

Más dos términos que la identidad de dos factores no captura:

- **[C] Salieron del piso** — archivos que estaban y ya no se cuentan.
- **[D] Entraron al piso** — superficies nuevas. Es costo, no ahorro.

### 4.1 El descompositor

Guardá como `$WORK/decompose.mjs`:

```javascript
import { surfaceLoadMap } from '<RUTA_DEL_REPO_AOI>/scripts/sdd-lifecycle/cache-prefix.mjs'

const B = surfaceLoadMap(process.argv[2])
const H = surfaceLoadMap(process.argv[3])
const keys = [...new Set([...B.keys(), ...H.keys()])]

let prosa = 0, mult = 0, salieron = 0, entraron = 0, fB = 0, fH = 0
const rowsSalieron = [], rowsEntraron = [], rowsProsa = []

for (const k of keys) {
  const b = B.get(k), h = H.get(k)
  const tB = b?.tokens ?? 0, mB = b?.phases.length ?? 0
  const tH = h?.tokens ?? 0, mH = h?.phases.length ?? 0
  fB += tB * mB; fH += tH * mH

  if (mB > 0 && mH === 0) { salieron += -(tB * mB); rowsSalieron.push({ f: k, tok: tB, x: mB, ciclo: tB * mB }) }
  else if (mB === 0 && mH > 0) { entraron += tH * mH; rowsEntraron.push({ f: k, tok: tH, x: mH, ciclo: tH * mH }) }
  else if (mB > 0 && mH > 0) {
    const p = mB * (tH - tB), s = tH * (mH - mB)
    prosa += p; mult += s
    if (p || s) rowsProsa.push({ f: k, tB, tH, x: mB, x2: mH, prosa: p, mult: s })
  }
}

console.log(`PISO  base ${fB}  ->  head ${fH}   DELTA ${fH - fB}\n`)
console.log(`  [A] PROSA recortada en archivos que siguen en el piso : ${prosa}`)
console.log(`  [B] MULTIPLICIDAD (mismo archivo, menos/más fases)    : ${mult}`)
console.log(`  [C] SALIERON del piso                                 : ${salieron}`)
console.log(`  [D] ENTRARON al piso                                  : ${entraron}`)
console.log(`  suma de control: ${prosa + mult + salieron + entraron}\n`)

console.log('=== [C] SALIERON — cada uno hay que abrirlo en la Fase 4 ===')
console.table(rowsSalieron.sort((a, b) => b.ciclo - a.ciclo))
console.log('=== [D] ENTRARON ===')
console.table(rowsEntraron.sort((a, b) => b.ciclo - a.ciclo))
console.log('=== [A]+[B] TOP RECORTES DE PROSA REAL ===')
console.table(rowsProsa.sort((a, b) => (a.prosa + a.mult) - (b.prosa + b.mult)).slice(0, 15))
```

```bash
node "$WORK/decompose.mjs" "$WORK/base" "$WORK/head"
```

> [!CAUTION]
> **La suma de control tiene que dar exactamente el delta del piso.** Si no cierra, tu
> descomposición está mal y todo lo que construyas encima es falso. No sigas hasta que cierre.

### 4.2 El error que se comete acá

Una descomposición de sólo dos términos asigna a «prosa» los archivos que **desaparecieron
del grafo** (donde `t_H = 0` porque nadie los referencia más, aunque el archivo siga en
disco). Eso infla el ahorro aparente. Los cuatro términos existen para no cometerlo.

---

## 5. Fase 4 — El paso que decide si el ahorro es real

El renglón **[C]** es el que hay que abrir archivo por archivo. La pregunta **no** es si esos
archivos son condicionales hoy. Es:

> **¿Ya eran condicionales en la versión vieja, y nadie los había marcado?**

Si la frase que los condiciona es **idéntica en las dos versiones**, la conducta no cambió:
lo único que cambió es que ahora hay un marcador que el instrumento sabe leer. Eso es
**contabilidad, no ahorro**.

### 5.1 Cómo se comprueba

Para cada archivo de la lista [C]:

```bash
NOMBRE="speckit.clarify"   # repetir por cada uno

echo "########## $NOMBRE ##########"
echo "--- ¿sigue existiendo el archivo en head? ---"
fd -t f "$NOMBRE" "$WORK/head/.github/agents/" 2>/dev/null || find "$WORK/head/.github/agents/" -name "*$NOMBRE*"

echo "--- cómo lo nombra HEAD ---"
rg -n "$NOMBRE" "$WORK/head/.github/prompts/"sdd-*.prompt.md

echo "--- cómo lo nombraba BASE ---"
rg -n "$NOMBRE" "$WORK/base/.github/prompts/"sdd-*.prompt.md
```

Compará las dos frases **literalmente**. Tres resultados posibles:

| Resultado | Lectura | Va al informe como |
| :--- | :--- | :--- |
| Frase idéntica en ambas | Ya era condicional; sólo faltaba el marcador | **Contabilidad pura** |
| La frase cambió de incondicional a condicional | Cambio de conducta real | **Ahorro condicional** — sólo se cobra cuando la rama no dispara |
| Dejó de estar referenciado por completo | Capacidad potencialmente perdida | **Abrir prueba de equivalencia** (Fase 9) |

### 5.2 Contar los marcadores

```bash
echo "=== marcadores en BASE ==="
rg -c 'conditional|one-of' "$WORK/base/.github/prompts/"sdd-*.prompt.md

echo "=== marcadores en HEAD ==="
rg -c 'conditional|one-of' "$WORK/head/.github/prompts/"sdd-*.prompt.md
```

Si BASE tiene cero, **toda** la clasificación condicional del instrumento sobre ese árbol es
inferida, no declarada — razón de más para hacer la comparación literal de frases.

### 5.3 La comparación honesta

Con los números de 5.1, calculá:

```
piso_base_ajustado = piso_base − (tokens de contabilidad pura)
ahorro_honesto     = piso_base_ajustado − piso_head
```

**Reportá los dos números**, el bruto y el honesto, y decí cuánto de la diferencia es
contabilidad. Reportar sólo el bruto es la misma forma de error que este proyecto ya corrigió
una vez con un «83,9%» fabricado.

---

## 6. Fase 5 — La banda ×6 y el contraste con la masa en disco

Un token recortado en un archivo que se carga en las seis fases vale seis. Uno recortado en
un prompt de fase vale uno. **La banda ×6 es donde el trabajo rinde.**

### 6.1 Medir la banda en ambos árboles

Guardá como `$WORK/band.mjs`:

```javascript
import { surfaceLoadMap, partitionSurface } from '<RUTA_DEL_REPO_AOI>/scripts/sdd-lifecycle/cache-prefix.mjs'

for (const [label, root] of [['BASE', process.argv[2]], ['HEAD', process.argv[3]]]) {
  const p = partitionSurface(surfaceLoadMap(root))
  console.log(`\n### ${label}`)
  console.log(`  Banda x6 : ${p.universal.length} archivos · ${p.universalPerPhase} tok/fase · ${p.universalCycle} por ciclo`)
  console.log(`  Parcial  : ${p.repeatedCycle} · Una vez: ${p.onceCycle}`)
  console.log(`  PISO     : ${p.floor}  (${((p.universalCycle / p.floor) * 100).toFixed(1)}% es masa repetida)`)
  for (const r of p.universal.sort((a, b) => b.cycleTokens - a.cycleTokens)) {
    console.log(`    ${String(r.cycleTokens).padStart(6)}  ${r.source}`)
  }
}
```

### 6.2 La masa de prosa en disco — el contraste que lo prueba

Guardá como `$WORK/raw-mass.mjs`:

```javascript
// Medida independiente del grafo de referencias: cuánta prosa EXISTE.
// No lee marcadores y no depende del instrumento, así que sirve de contraste.
import fs from 'node:fs'
import path from 'node:path'
import { estimateTokens } from '<RUTA_DEL_REPO_AOI>/scripts/sdd-lifecycle/token-accounting.mjs'

// EL MISMO estimador que el instrumento. La versión anterior usaba
// `Math.ceil(len/4)` mientras el instrumento usa `Math.round(len/4)`: el
// contraste arrancaba con un sesgo de hasta +1 token por archivo, y la
// convergencia del paso 6.3 se medía contra un error de redondeo propio.
const est = estimateTokens

const walk = (d) => {
  if (!fs.existsSync(d)) return []
  if (fs.statSync(d).isFile()) return [d]
  const o = []
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    o.push(...(e.isDirectory() ? walk(p) : [p]))
  }
  return o
}

// Toda superficie que un harness INYECTA. Incluye los adaptadores de raíz:
// son archivos sueltos, no directorios, y la lista tiene que aceptar las dos
// formas — omitirlos era medir tres harness de cinco y llamarlo "la masa".
// NO van acá `README.md` ni `AOI_REAL_WORLD_VERIFICATION_MATRIX.md`: se leen
// a demanda, ningún harness los inyecta, y contarlos infla el contraste con
// prosa que nadie paga en cada turno.
const SUP = [
  '.github/prompts', '.github/agents', '.github/instructions', '.github/skills',
  '.agents/skills',
  '.github/copilot-instructions.md', 'CLAUDE.md', 'AGENTS.md',
  '.cursorrules', '.clinerules', '.cursor/rules', '.agents/rules',
]

const scan = (root) => {
  const out = {}; let tot = 0, files = 0
  for (const s of SUP) {
    const fl = walk(path.join(root, s))
    const t = fl.reduce((n, f) => n + est(fs.readFileSync(f, 'utf8')), 0)
    out[s] = { files: fl.length, tokens: t }; tot += t; files += fl.length
  }
  return { ...out, TOTAL: { files, tokens: tot } }
}
const a = scan(process.argv[2]), b = scan(process.argv[3])
console.table(Object.keys(a).map((k) => ({
  Superficie: k, 'arch base': a[k].files, 'tok base': a[k].tokens,
  'arch head': b[k].files, 'tok head': b[k].tokens, Delta: b[k].tokens - a[k].tokens,
})))
```

### 6.3 La lectura

Cruzá los dos resultados. Si la masa en disco **casi no se movió** pero el piso cayó mucho,
el recorte se hizo exactamente donde el multiplicador es alto. Ese contraste es la prueba de
que la estrategia fue *cortar donde vale seis, gastar donde vale uno* — y no se ve mirando
ninguno de los dos números por separado.

Verificación cruzada: el delta de la banda $\times 6$ debería converger con el término **[A]**
de la descomposición. "Converger" tiene que tener número, o no es verificable:

```
| bandax6Delta − [A] | / max(1, |[A]|)  ≤  0.10
```

Dentro del 10%, dos métodos independientes coinciden y el resultado es sólido. **Fuera de
esa banda no lo declares convergente**: hay un archivo que cambió de banda (de $\times 6$ a
parcial, o al revés) y la identidad de dos factores no lo captura. Buscalo en el renglón [C]
de la Fase 3 antes de escribir el titular.

### 6.4 La banda del otro harness

El piso estándar mide `.github/skills` y `.github/instructions`, que es la factura de
Copilot/Claude. **Antigravity lee `.agents/skills` y no lee `.github/instructions`.** Medí
las dos o tu titular describe un solo harness:

```bash
node -e '
import("<RUTA>/scripts/sdd-lifecycle/context-budget.mjs").then(m => {
  for (const [l, r] of [["BASE", process.argv[1]], ["HEAD", process.argv[2]]]) {
    const b = m.harnessSkillBands(r)
    console.log(l, "· .github/skills:", b.github, "· .agents/skills:", b.agents)
  }
})' "$WORK/base" "$WORK/head"
```

### 6.5 La masa que NINGÚN instrumento cuenta

Las dos bandas de 6.4 siguen sin ser la factura completa de ningún harness. El instrumento
suma cuatro raíces — `.github/prompts`, `.github/agents`, `.github/instructions`,
`.github/skills` — más la banda `.agents/skills`. Todo lo demás que un harness inyecta al
abrir sesión queda **fuera del piso medido**, y el contraste de 6.2 tampoco lo veía antes de
la corrección.

Medido en `v2.3.0`, son **1.930 tokens por sesión** — un **2,22% del piso de 86.873**. Es
chico. El problema no es el tamaño, es la clase: es exactamente el defecto que
`instruction-scope.mjs` documenta haber cometido con las skills — *el costo nunca estuvo mal,
nunca se contó* — y un auditor que no lo declara está publicando un piso que no es el piso de
nadie.

#### Ya no es un script externo: el instrumento lo mide

Desde `v2.4.0` **no escribas un script auxiliar para esto.** El número sale del propio
instrumento, que es donde tiene que estar para que ninguna auditoría pueda olvidarlo:

```bash
node -e '
import("<RUTA_DEL_REPO_AOI>/scripts/sdd-lifecycle/context-budget.mjs").then((m) => {
  for (const [label, root] of [["BASE", process.argv[1]], ["HEAD", process.argv[2]]]) {
    const b = m.auditContextBudget(root)
    console.log(`\n### ${label}`)
    console.log(m.formatHarnessAdapters(b.adapters, b.floor))
  }
})' "$WORK/base" "$WORK/head"
```

La forma que devuelve `auditContextBudget` — y esto es un **contrato**, no un detalle:

| Campo | Qué es |
| :--- | :--- |
| `floor` | El piso de siempre. **No cambia** cuando cambian los adaptadores. |
| `adapters` | `{ rows, total }` — lo que el piso no cuenta, con una fila por superficie. |
| `floorWithAdapters` | `floor + adapters.total`. La factura de un Copilot, explícita. |

> [!CAUTION]
> **No sumes `adapters` a `floor`.** Tienta, es un solo carácter, y rompe la comparación
> histórica: cada línea base medida antes de `v2.4.0` quedaría incomparable contra las nuevas
> y el cambio se leería como una regresión de tokens que no ocurrió. Los dos números se
> reportan por separado, siempre. El test `el piso NO se mueve` de
> `context-budget-adapters.test.mjs` existe para que ese "arreglo" no pase inadvertido.

Si agregás un adapter de harness nuevo, agregalo a `HARNESS_ADAPTERS` en
`scripts/sdd-lifecycle/context-budget.mjs`. La lista es una sola y el instrumento la expone:
una segunda copia en la prosa es una copia que va a derivar.

**Cómo entra en el informe.** Como renglón de **alcance**, con esta forma: *"el piso reportado
excluye $X$ tokens de adaptadores de harness; el piso total de un Copilot es de $Y$"*. Y
agregá el renglón al checklist de cierre.

---

## 7. Fase 6 — Payload variable, y por qué casi nunca es comparable

```bash
( cd "$WORK/base" && node scripts/sdd-lifecycle/sdd-stress-suite.mjs 2>&1 | head -45 )
( cd "$WORK/head" && node scripts/sdd-lifecycle/sdd-stress-suite.mjs 2>&1 | head -45 )
```

> [!WARNING]
> **Las dos corridas NO miden la misma entrada.** `buildDiscoveryCorpus` construye el corpus
> leyendo el propio `scripts/` del árbol, así que cada versión se mide contra un corpus
> distinto. Una mejora de «1,8 puntos» puede ser puro artefacto del corpus.

### 7.1 Antes de comparar dos versiones: comprobá que el instrumento se reproduzca

Esto va **primero**, y es una condición previa que no estaba escrita en ningún lado. El paso
6.3 exige convergencia entre dos métodos; comparar dos versiones exige algo anterior: que el
instrumento dé **el mismo número dos veces sobre el mismo árbol**.

Medido el 2026-09-12, y **fallaba**: el mismo comando daba `5844 -> 1051` y después
`5845 -> 1052`, con el payload oscilando entre 4.683 y 4.684.

```bash
# Dos corridas sobre el árbol que estás midiendo. Un solo valor = reproducible.
for i in 1 2; do
  ( cd "$ROOT" && node scripts/sdd-lifecycle/sdd-stress-suite.mjs 2>/dev/null ) \
    | rg -o 'Payload optimizado del ciclo:\s+[0-9,]+'
done | sort -u | wc -l    # 1 = sirve. 2+ = no sirve, y nada de lo que siga vale.
```

> [!CAUTION]
> **Si da 2 o más, PARÁ.** Un instrumento que no se reproduce contra sí mismo no puede comparar
> dos versiones: un ±1 token se lee como una mejora o una regresión que no ocurrió. Es la regla
> 1 del protocolo aplicada al instrumento mismo.

**La causa, porque es la forma general del problema.** El stress suite no mide sólo archivos:
en la Fase 3 corre `node --test` de verdad y **mide su salida**. Esa salida trae duraciones de
test y el nombre aleatorio de un directorio temporal — o sea que el instrumento medía **un
proceso vivo** y lo reportaba como *"aritmética estática sobre archivos en disco"*. Tres
fuentes distintas, cada una con su propia regla de limpieza: ver **A.16**.

> **No preguntes si el instrumento es estático: comprobalo.** El mensaje del propio suite
> afirmaba "0 tokens de inferencia" y "aritmética estática", y las dos cosas eran ciertas. Lo
> que no era cierto es que fuera **reproducible**, que es otra propiedad.

#### 7.2 El payload tiene que ser función del ÁRBOL, y hay una fase que no lo es

El paso 7.1 exige que el instrumento se reproduzca **contra sí mismo**. Hay una condición más
fuerte y la encontró una lente adversarial: que el número sea función del **árbol**, y no del
entorno.

Medido: **la Fase 0 lee el store ICM vivo.** `icm facts list`, `icm wake-up` y `icm recall`
consultan un almacén **compartido y mutable** —el mismo que los otros proyectos escriben—, así
que agregar **un solo hecho** movía el payload de 4.607 a 4.643 y el consumo base de 20.711 a
20.427, **con `git status` vacío**. El número no describía el árbol que se estaba auditando.

```bash
# Para comparar DOS VERSIONES, excluí la fase que depende del entorno:
node scripts/sdd-lifecycle/sdd-stress-suite.mjs --hermetic
```

`--hermetic` omite la Fase 0 y el total vuelve a ser función del árbol. Sin el flag se sigue
midiendo, porque el ahorro de grounding O(1) contra recall semántico es real y vale verlo —
pero **entonces el payload no es comparable entre versiones**, que es exactamente para lo que
sirve la Fase 6.

> [!CAUTION]
> **Un benchmark no puede leer estado mutable compartido y llamarse reproducible.** Es la misma
> familia que las otras trampas de este apéndice: el instrumento mide algo más de lo que dice
> medir. Si tu número cambia cuando cambia algo fuera del árbol, no estás midiendo el árbol.

#### 7.3 Y la captura de un proceso hijo no puede depender del `cwd`

Segunda fuente, también medida: `captureRealTestRun` corría `node --test` **heredando el cwd del
padre**, y el reporter `spec` imprime las ubicaciones **relativas a ese cwd**. El mismo árbol,
byte a byte, medido desde otra profundidad producía `../../../../../private/…` en vez de `../…`,
y el payload cambiaba. `stripVolatile` no puede cubrirlo: no sabe cuántos niveles de `../` va a
haber.

Arreglado con un `cwd` **fijo** en el directorio temporal. Verificado: la captura da 1890 bytes
desde el repo y desde `/tmp`, idéntica.

Qué sí es comparable: el **payload optimizado absoluto**. Si se mantiene prácticamente igual,
esa es la señal correcta de que el ciclo de trabajo tocó la **prosa fija** y no los mecanismos
de compresión. Anotá también la **fidelidad**: cuántas fases se midieron sobre artefactos
reales, cuántas sobre fixtures y cuántas se omitieron. Un porcentaje sobre fixtures es
representativo en proporción pero no en volumen.

#### 7.4 Y ninguna lectura de reloj dentro de un camino medido

Tercera condición, y la más fácil de saltear porque **no se ve en el número**. El paso 7.2 pide
que el payload sea función del árbol; el suite tenía, en la Fase 5, un
`new Date().toISOString().slice(0, 10)` dentro de la plantilla que se mide.

**Primero, la corrección: eso NO mueve el número, y yo había reportado que sí.** Medido con
tres fechas sobre el mismo árbol —`2026-09-12`, `1999-01-01` y `0001-01-01`— las dos fases dan
idénticas: `261 -> 32` en la Fase 5 y `20.941 -> 4.595` en el total. La razón es que
`estimateTokens` es `Math.round(len / 4)` y `slice(0, 10)` tiene ancho fijo: **la invariancia se
sostenía por aritmética, no por construcción.**

**Segundo, la enumeración, que es el método que este paso agrega.** No alcanza con arreglar la
lectura que encontraste: hay que contarlas todas.

```bash
rg -n 'new Date\(|Date\.now\(|performance\.now\(|toISOString\(|Date\.UTC\(|process\.hrtime' scripts/
```

Medido: **29 archivos leen el reloj en `scripts/`, y exactamente uno alimentaba una medición.**
Los otros son comportamiento real y legítimo —`registry-sync.mjs` deriva el año de los IDs de
tarea, `subagent-fiber-runner.mjs` construye un `realmId` único, `mutation-probe.mjs` mide un
timeout, y los `timestamp` de `aoi-doctor` y `mechanical-verify-union` son metadatos de salida—.
Los artefactos de instalación que refrescan `updated_at` ya están declarados como excepción
legítima en A.13.

**El arreglo.** La fecha pasó a ser un parámetro explícito de
`buildArchiveClosure({ taskId, taskDirRel, date })` en `real-corpus.mjs`, con un guardia que
**rechaza** cualquier fecha que no mida diez caracteres exactos:

```js
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/
if (!CALENDAR_DATE.test(date)) throw new Error('fecha fuera del formato ISO corto (10 chars)')
```

Con eso la masa **no puede** depender del valor del calendario, sea cual sea el estimador que se
enchufe después. Y hay compuerta: cuatro casos en `real-corpus.test.mjs` que exigen masa igual
entre siete fechas, ancho igual, rechazo de cinco formas mal formadas, y que el default siga
siendo la fecha del reloj.

> [!CAUTION]
> **No alcanza con que el número no se mueva: eso puede ser una propiedad del ESTIMADOR.** Acá
> se sostenía porque `estimateTokens` dividía por cuatro, y un estimador se cambia en una línea
> —este apéndice tiene trampas enteras sobre esa clase de cambio—. La regla: si una entrada del
> camino medido no es función del árbol, arreglala **por construcción**, con guardia y con test,
> y no por observación.

---

## 8. Fase 7 — Instrumentación, compuertas y tests

### 8.1 Qué instrumentos existen en cada versión

La lista es la de los instrumentos que este protocolo **usa o debería usar**, no la de los
que existen: un instrumento que la auditoría nunca corre es un instrumento que no audita.

```bash
for f in scripts/sdd-lifecycle/context-budget.mjs \
         scripts/sdd-lifecycle/cache-prefix.mjs \
         scripts/sdd-lifecycle/phase-handoffs.mjs \
         scripts/sdd-lifecycle/instruction-scope.mjs \
         scripts/sdd-lifecycle/phase-references.mjs \
         scripts/sdd-lifecycle/behavioral-probes.mjs \
         scripts/sdd-lifecycle/registry-sync.mjs \
         scripts/sdd-lifecycle/invariant-gate.mjs \
         scripts/scaffold/validate-test-globs.mjs \
         scripts/scaffold/validate-srp.mjs \
         scripts/scaffold/source-reachability.mjs \
         scripts/scaffold/failure-injection.mjs \
         scripts/scaffold/mutation-probe.mjs \
         scripts/scaffold/mutation-ratchet.mjs \
         scripts/scaffold/gate-exit-codes.test.mjs \
         scripts/multi-harness/validate-agent-routing.mjs \
         scripts/multi-harness/token-tool-coverage.mjs \
         scripts/multi-harness/reference-integrity.mjs \
         scripts/multi-harness/cache-guard.mjs \
         scripts/multi-harness/install-hooks.mjs \
         scripts/multi-harness/zero-input-verdicts.test.mjs \
         scripts/multi-harness/audit-protocol-integrity.mjs ; do
  b=$([ -f "$WORK/base/$f" ] && echo SI || echo NO)
  h=$([ -f "$WORK/head/$f" ] && echo SI || echo NO)
  printf "base:%s  head:%s  %s\n" "$b" "$h" "$f"
done
```

> Un instrumento que **no existía** en la versión vieja significa que esa versión no podía
> medir esa dimensión. Suele ser el hallazgo más grande de la auditoría y no aparece en
> ningún diff.

### 8.2 Correr todas las compuertas en ambos árboles

```bash
for ROOT in "$WORK/base" "$WORK/head"; do
  echo "===== $ROOT ====="
  for f in scripts/scaffold/validate-scaffold-parity.mjs \
           scripts/scaffold/validate-test-globs.mjs \
           scripts/scaffold/validate-srp.mjs \
           scripts/scaffold/source-reachability.mjs \
           scripts/multi-harness/validate-agent-routing.mjs \
           scripts/multi-harness/install-hooks.mjs \
           scripts/sdd-lifecycle/phase-handoffs.mjs \
           scripts/sdd-lifecycle/cache-prefix.mjs \
           scripts/multi-harness/token-tool-coverage.mjs \
           scripts/sdd-lifecycle/registry-sync.mjs \
           scripts/multi-harness/reference-integrity.mjs \
           scripts/multi-harness/cache-guard.mjs \
           scripts/multi-harness/audit-protocol-integrity.mjs ; do
    [ -f "$ROOT/$f" ] || { echo "  [--] $f (no existe)"; continue; }
    # NO uses `timeout ... || node "$f"`. El `||` no distingue "timeout no está
    # instalado" de "la compuerta falló", así que re-ejecuta ENTERA toda roja
    # —y el código que terminás reportando es el de la segunda corrida— y, si
    # el `timeout` existe y la compuerta se cuelga, el fallback la vuelve a
    # correr SIN timeout y cuelga la auditoría. Ver A.11.
    if command -v timeout >/dev/null 2>&1; then
      out=$( cd "$ROOT" && timeout 180 node "$f" 2>&1 ); code=$?
    else
      out=$( cd "$ROOT" && node "$f" 2>&1 ); code=$?
    fi
    echo "  [$code] $(basename $f) -> $(echo "$out" | tail -1 | cut -c1-90)"
  done
done
```

> [!IMPORTANT]
> **`install-hooks.mjs` se corre con `--audit`.** Invocado sin la bandera no audita nada:
> **escribe** en la configuración de cada harness. Reproducido en `v2.3.0`: corriéndolo
> desnudo, `.claude/settings.json` quedó reescrito en el árbol de trabajo (byte-idéntico acá
> porque ya estaba instalado, pero es una escritura, no una lectura). Una auditoría que toca
> el árbol que estaba midiendo deja de poder decir qué midió.

### 8.3 Suites y paridad

```bash
for ROOT in "$WORK/base" "$WORK/head"; do
  echo "===== $ROOT ====="
  ( cd "$ROOT" && node --test "scripts/**/*.test.mjs" 2>&1 | tail -7 )
  ( cd "$ROOT" && node scripts/scaffold/validate-scaffold-parity.mjs 2>&1 | tail -1 )
  ( cd "$ROOT" && node scripts/aoi-doctor.mjs 2>&1 | rg 'Diagnostic Summary' )
done
```

Compará también **los pasos declarados en `pnpm test`**:

```bash
git show "$BASE":package.json | rg -n '"test":'
rg -n '"test":' package.json
```

### 8.4 Qué queda afuera del bucle, con nombre y apellido

El bucle de 8.2 corre **13 pasos**; `pnpm test` encadenaba **24** en `v2.3.0` — **25 desde
`v2.4.0`**, que le suma `aoi:audit-protocol`. Contá el tuyo antes de citar el número:

```bash
node -e 'const s=require("./package.json").scripts.test; console.log(s.split("&&").length)'
```

La diferencia no es un descuido, pero **tampoco puede quedar implícita**: el informe que exige
honestidad de alcance en la Fase 14 tiene que aplicársela primero a la Fase 7. Declarala con
estos nombres:

| Fuera del bucle | Por qué |
| :--- | :--- |
| `pnpm aoi:mutation` | Es lento a propósito (corre cada área una vez por mutante). Va en la **Fase 8**, no acá. |
| `pnpm aoi:stress-sdd` | Payload variable: se mide en la **Fase 6**, y casi nunca es comparable. |
| `pnpm aoi:probes` | Genera sondas; se juzga en el **13.3**. |
| `pnpm aoi:context`, `pnpm aoi:cache-prefix` (modo reporte) | Instrumentos de medición, no compuertas. Ya se usaron en las Fases 2–5. |
| `test:doctor`, `test:multi-harness`, `test:sdd-lifecycle`, `test:sandbox`, `test:memory-sync`, `test:memory-sync:bundle`, `test:subagent-payload`, `test:conf`, `test:spatiotemporal`, `test:mcp-gateway`, `test:code-lens`, `test:dashboard` | Suites. Ya las cubre el `node --test "scripts/**/*.test.mjs"` de 8.3, y una por una no agregan una dimensión nueva. |

Si tu auditoría **no** corrió alguno de los que sí importan, escribilo en el informe. Un paso
que falta y se calla se lee como un paso que pasó.

---

## 9. Fase 8 — Falso verde: la dimensión más cara

Una compuerta que nadie vio fallar es indistinguible de una que **no puede** fallar.

### 9.0 Antes de fabricar nada: corré el ratchet que ya existe

Este protocolo mandaba inventar a mano, compuerta por compuerta, la falla que cada una dice
cazar. Eso es correcto y es caro. Pero el repositorio **ya tiene un instrumento que hace esa
pregunta de forma sistemática y por línea**, y hasta `v2.3.0` el protocolo no lo nombraba ni
una vez:

```bash
( cd "$ROOT" && pnpm aoi:mutation )
```

`scripts/scaffold/mutation-ratchet.mjs` guarda un piso de score por área
(`MUTATION_FLOOR`) y falla si baja. Un mutante que sobrevive es, textualmente, una línea que
nadie mira — la misma pregunta que 9.2 responde a mano, pero sobre todas las líneas y con el
resultado congelado. Es lento a propósito (corre cada área una vez por mutante, minutos de
CPU, cero tokens de inferencia), así que no está en la cadena de `pnpm test`: **es una
medición deliberada, y una auditoría es exactamente el momento de hacerla.**

Leé también `MUTATION_FLOOR` para saber qué áreas **no** tienen ratchet:

```bash
rg -n 'MUTATION_FLOOR' -A25 scripts/scaffold/mutation-ratchet.mjs
```

Las compuertas que no caen en ninguna de esas áreas son las únicas que necesitan que
fabriques la falla a mano en 9.2. Las demás ya tienen quien las mire.

**Y reportá el resultado, no sólo que corrió.** La salida del ratchet tiene cuatro datos y los
cuatro van al informe:

| Dato | Por qué importa |
| :--- | :--- |
| Score por área contra su piso | Una caída **es un hallazgo crítico**: significa que un cambio aflojó los tests |
| `N sobreviven` por área | Dónde la suite **no** está atando. Es el mapa de lo que falta cubrir |
| La suma total | El titular honesto: *"$T$ mutantes, $S$ sobreviven, $K$% matados"* |
| Qué áreas mejoraron | El ratchet te pide subirlas. **Hacelo**: si no, el trinquete sólo retiene caídas y el progreso se pierde |

> [!IMPORTANT]
> **Una mejora de score es un cambio de código, no una nota.** Si el ratchet dice *"subieron,
> actualizá `MUTATION_FLOOR`"*, esa edición va al informe como entregable: sin ella, la próxima
> medición puede caer al piso viejo sin que nada falle, y la mejora deja de estar protegida.

> [!WARNING]
> **Los scores bajos NO son un hallazgo por sí mismos.** `MUTATION_FLOOR` los fija "low on
> purpose rather than aspiration" — registrar dónde están las suites es lo que hace visible la
> próxima mejora. Reportarlos como deuda cuando coinciden con el piso es inventar un problema;
> lo que se reporta es **cuántos sobreviven** y **dónde**.

### 9.1 Cruzar la lista

Sacá la lista de compuertas que `pnpm test` corre y la lista de compuertas que algún test
**ve salir distinto de cero**. La diferencia es tu zona de riesgo. Que el cruce sea un cálculo
y no una lectura:

```bash
# Compuertas de la cadena
node -e 'console.log(require("./package.json").scripts.test.split("&&").map(s=>s.trim()))'

# Compuertas con caso de exit no-cero declarado
rg -n 'runGate\(' scripts/scaffold/gate-exit-codes.test.mjs
rg -n 'GATES' -A8 scripts/multi-harness/zero-input-verdicts.test.mjs
```

> [!NOTE]
> `gate-exit-codes.test.mjs` es la red de la cadena y `zero-input-verdicts.test.mjs` la red
> del *verde sobre nada*. Son dos preguntas distintas: la primera pregunta "¿puede fallar?",
> la segunda "¿falla cuando no hay nada que mirar?". Una compuerta puede pasar la primera y
> ser un desastre en la segunda.

### 9.2 Inyectar la falla, siempre en copia aislada

> [!CAUTION]
> **Nunca inyectes fallas en el árbol de trabajo.** Copiá el repositorio a un directorio
> descartable, rompé ahí, medí, y borrá la copia.

El patrón **ya está extraído a un módulo importable**, que es lo que hasta `v2.3.0` no era:
el protocolo mandaba reusar `mirror`, `runGate` y `withViolation` "de `gate-exit-codes.test.mjs`",
y esas tres eran funciones privadas de un archivo `.test.mjs`. Importar un `.test.mjs` no
expone nada y además **vuelve a correr la suite entera**: la instrucción era inejecutable y
el que la seguía al pie de la letra metía una corrida completa de tests adentro de su script.
Ahora vive en `scripts/scaffold/failure-injection.mjs` y se importa:

```javascript
import { mirror, runGate, withViolation, append, prepend, sandboxFrom }
  from '<RUTA_DEL_REPO_AOI>/scripts/scaffold/failure-injection.mjs'
```

| Función | Firma | Qué hace |
| :--- | :--- | :--- |
| `mirror` | `(src, dest, skip?)` | Copia el árbol saltando `node_modules`, `.git`, `.nuxt`, `dist`, `.output`, `.venv`, `.sandboxes` |
| `sandboxFrom` | `(repoRoot, prefix?)` | `mkdtemp` + `mirror`, en un paso |
| `runGate` | `(root, script, timeoutMs?)` | Corre la compuerta en la copia y devuelve el exit code; nunca lanza. `124` = se colgó |
| `withViolation` | `(root, relFile, mutate, script)` | Aplica, mide y **restaura en `finally`** — sin eso la primera violación contamina todas las mediciones siguientes |
| `append` / `prepend` | `(texto)` | Mutadores listos, para no reescribirlos |

Tres líneas y ya tenés la copia aislada y una mutación medida:

```javascript
const root = sandboxFrom(process.argv[2], 'aoi-audit-')
const code = withViolation(root, '.github/prompts/sdd-verify.prompt.md',
  prepend('<!-- 2026-09-12T00:00:00 -->'), 'scripts/multi-harness/cache-guard.mjs')
console.log(code === 0 ? '❌ FALSO VERDE' : `✅ la compuerta lo caza (exit ${code})`)
```

Para cada compuerta sin cobertura, inyectá **la violación exacta que dice cazar**:

| Compuerta | Violación a inyectar |
| :--- | :--- |
| `validate-scaffold-parity` | Agregar una línea a un archivo gobernado de la raíz y no a su espejo |
| `source-reachability` | Crear un `.mjs` que nada importe |
| `token-tool-coverage` | Borrar la invocación de una herramienta obligatoria del prompt que la llama |
| `registry-sync` | Crear un directorio de tarea en `.tasks/` que el registro no liste |
| `validate-srp` | Un archivo de más de 300 LOC |
| `validate-test-globs` | Apuntar un glob a un directorio que **existe** y no tiene tests |
| `cache-guard` / `cache-prefix` | Un timestamp o contenido volátil en un prompt de la banda |
| `phase-handoffs` | Que un productor deje de nombrar su artefacto |
| `reference-integrity` | Una referencia a un script inexistente |
| `validate-agent-routing` | Un agente en disco sin fila en el registro |
| `audit-protocol-integrity` | Renombrar una ruta `scripts/*.mjs` **desnuda** dentro del protocolo |
| `install-hooks` | Sacar una declaración de `.github/hooks/*.json` |

**Resultado esperado: exit distinto de cero en todas.** Si alguna sale 0, ese es un hallazgo
crítico. Si todas fallan como deben, el hallazgo es más chico pero igual real: *faltaba la
prueba*, y ahora existe.

> [!WARNING]
> **Copiá, no importes, cuando el archivo de destino sea un `.test.mjs` de otro.** El caso
> `audit-protocol-integrity` se inyecta editando el protocolo, no importando la compuerta.
> Importar un módulo de test para reusar sus helpers es el error que este mismo paso ya
> cometió una vez.

### 9.3 Buscar el falso verde por lectura

Además de inyectar, leé cada compuerta buscando:

- un glob que no matchea nada y el bucle no itera;
- un `catch` que traga el error y sigue;
- un `return` temprano antes de la aserción;
- una lista vacía comparada contra otra lista vacía;
- un `exit 0` por defecto al final del archivo.

Y comprobá que **cada compuerta reporte cuánto verificó**. Una que dice «OK» sin decir sobre
cuántos elementos es indistinguible de una que no miró nada.

---

## 10. Fase 9 — Herramientas obligatorias y su invocación real

La regla del producto: **todas las herramientas de ahorro son obligatorias, salvo Headroom.**

### 10.1 Qué hace el instalador ante un fallo

```bash
rg -n 'install_rtk|install_icm|install_mcp_compressor|require_' "$WORK/base/setup.sh" | head
rg -n 'install_rtk|install_icm|install_mcp_compressor|require_' "$WORK/head/setup.sh" | head
```

Mirá el bloque alrededor de cada invocación: **¿`exit 1` o `warn` y continuar?** Una
herramienta cuyo fallo no bloquea la instalación es opcional de hecho, diga lo que diga la
documentación. La única que debe continuar con `warn` es Headroom.

### 10.2 No le creas a la compuerta: auditala

```bash
( cd "$WORK/head" && node scripts/multi-harness/token-tool-coverage.mjs )
```

Y después leé **cómo define «invocada»**:

```bash
rg -n 'export function invokesTool' -A30 "$WORK/head/scripts/multi-harness/token-tool-coverage.mjs"
```

La pregunta correcta: *¿cuenta una mención en prosa como invocación?* Si alcanza con que el
nombre aparezca en un archivo, la compuerta puede estar verde con herramientas que nadie
ejecuta. La regla correcta es **posicional**: el nombre tiene que estar donde va un comando —
dentro de un code span, de un bloque cercado, o al principio de una línea de shell.

### 10.3 Verificación independiente

Para cada herramienta obligatoria, encontrá la línea exacta que la invoca y en qué fase corre:

```bash
for t in rtk icm codebase-memory-mcp toon context-tombstone ast-skeletonizer \
         context-arranger synthesize-stubs diagnostic-distiller \
         mechanical-verify-union mcp-compressor ; do
  echo "--- $t ---"
  rg -n "$t" "$WORK/head/.github/prompts/" "$WORK/head/.github/agents/" 2>/dev/null | head -3
done
```

Si la única mención es descriptiva y no ejecutable, es **herramienta huérfana** aunque la
compuerta esté verde.

---

## 11. Fase 10 — Cableado: ¿quién invoca a quién?

> **La pregunta correcta nunca es «¿existe la herramienta?» sino «¿quién la invoca en el
> ciclo real?».**

Guardá como `$WORK/wiring.mjs` y corré con `cwd` en el árbol a auditar:

```javascript
import fs from 'node:fs'
import path from 'node:path'

const IGNORAR = new Set(['node_modules', '.git', '.tasks', '.resources'])
const walk = (d, o = []) => {
  if (!fs.existsSync(d)) return o
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (IGNORAR.has(e.name)) continue
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p, o)
    else o.push(p)
  }
  return o
}

const srcs = walk('scripts').filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs'))
const pkg = fs.readFileSync('package.json', 'utf8')
const prosa = [...walk('.github'), ...walk('.githooks'), ...walk('docs')]
  .filter((f) => /\.(md|json|sh|yml)$/.test(f))
  .map((f) => fs.readFileSync(f, 'utf8')).join('\n')
const raiz = ['setup.sh', 'teardown.sh', 'AOI_REAL_WORLD_VERIFICATION_MATRIX.md', 'CLAUDE.md', 'AGENTS.md']
  .filter(fs.existsSync).map((f) => fs.readFileSync(f, 'utf8')).join('\n')
const code = walk('scripts').filter((f) => f.endsWith('.mjs')).map((f) => [f, fs.readFileSync(f, 'utf8')])

console.log('Fuentes .mjs (sin tests):', srcs.length)
for (const s of srcs) {
  const base = path.basename(s)
  const enPkg = pkg.includes(s) || pkg.includes(base)
  const enProsa = prosa.includes(base) || raiz.includes(base)
  const importado = code.some(([f, t]) => f !== s && !f.endsWith('.test.mjs') && t.includes(base))
  const soloTest = code.some(([f, t]) => f.endsWith('.test.mjs') && t.includes(base))
  if (!enPkg && !enProsa && !importado) {
    console.log(`  ${soloTest ? '[SOLO SUS TESTS]' : '[NADIE        ]'} ${s}`)
  }
}
```

```bash
( cd "$WORK/head" && node "$WORK/wiring.mjs" )
```

### 11.1 Cómo leer el resultado

Cada candidato hay que **verificarlo a mano** antes de reportarlo. La sonda mira un conjunto
acotado de superficies; siempre hay falsos positivos. Comprobalo con:

```bash
rg -ln "<nombre-del-componente>" setup.sh teardown.sh AOI_REAL_WORLD_VERIFICATION_MATRIX.md \
  CLAUDE.md AGENTS.md README.md docs/ .github/ scripts/ package.json 2>/dev/null
```

Y verificá con `node` si `rg` devuelve vacío — ver Apéndice A.

Un componente que sólo alcanzan **sus propios tests** es una herramienta huérfana: existe,
está testeada, y el producto no la entrega. Costo en tokens: cero, porque es código y no
prosa inyectada. El costo es de otra clase — una capacidad declarada que nadie usa.

> `source-reachability` **no** cubre esto: mide alcance *desde un test*, que es otra pregunta.
> `token-tool-coverage` tampoco, porque sólo mira su propia lista de herramientas de ahorro.
> El hueco entre las dos es donde vive este hallazgo.

---

## 12. Fase 11 — Prueba de equivalencia por cada recorte

**Regla del producto: un ahorro de tokens nunca justifica una pérdida de capacidad no
demostrada equivalente.**

Para cada instrucción, paso o archivo que la versión nueva eliminó:

1. **Nombrá la capacidad** que esa prosa producía, en una frase.
2. **Encontrá dónde vive ahora**: un script determinista, otra skill, un hook, otra fase.
3. **Si no vive en ningún lado**, es `capacidad-perdida` y va al informe con esa etiqueta.

### 12.1 El error que hay que evitar acá

No asumas que un paso eliminado era lo que su rótulo decía. **Leé el archivo del agente o del
script y fijate qué hacía realmente.**

Caso real de esta auditoría: `/speckit.checklist` corría como paso 6 de `/sdd-verify` con el
rótulo «formal verification», y parecía el candidato obvio a capacidad perdida cuando se lo
sacó. El propio archivo del agente dice en negrita lo contrario: *«NOT for verification/testing
— NOT checking if code/implementation matches the spec»*. Es una herramienta de **calidad de
requisitos**. O sea que la versión vieja la corría en la fase equivocada, y moverla fue una
**corrección**, no una pérdida. El número no cambia; su lectura sí.

Moraleja operativa: **la prueba de equivalencia se hace contra lo que el componente hace, no
contra cómo lo llamaba el prompt que lo invocaba.**

---

## 13. Fase 12 — Ciclo de vida, Invariant Gate y sandboxes

```bash
( cd "$WORK/head" && node scripts/sdd-lifecycle/phase-handoffs.mjs )
```

¿Hay algún artefacto que una fase exige como entrada y que ninguna fase anterior produce?
Eso rompe el ciclo.

### 13.1 La pregunta que decide: ¿falla cerrado o abierto?

```bash
rg -n 'process.exit|BLOCKED|catch' "$WORK/head/scripts/sdd-lifecycle/invariant-gate.mjs"
```

- **Falla cerrado** = ante una cadena de herramientas rota emite un código distinto de cero
  y dice que la ausencia de evidencia no es evidencia de cumplimiento. **Correcto.**
- **Falla abierto** = sale 0 y el ciclo continúa. **Hallazgo de severidad alta.**

### 13.2 El flag que convierte un FAIL en un exit

Muchos gates sólo bloquean si se les pasa un flag (`--exit-code` o equivalente). Verificá que
**todas las invocaciones documentadas lo lleven**:

```bash
rg -n 'invariant-gate' "$WORK/head/.github/prompts/" "$WORK/head/.github/agents/" \
  "$WORK/head/.github/skills/" "$WORK/head/.github/instructions/" "$WORK/head/package.json"
```

Una invocación sin el flag reporta FAILED y sale 0, y ninguna cadena de `&&` lo nota.

**Y después corré cada invocación desnuda.** El `rg` te dice dónde está escrito; el exit code
te dice qué hace. Los dos no coinciden siempre:

```bash
# El script de npm es una invocación documentada como cualquier otra.
node scripts/sdd-lifecycle/invariant-gate.mjs          ; echo "sin args  EXIT=$?"
node scripts/sdd-lifecycle/invariant-gate.mjs --exit-code ; echo "con flag  EXIT=$?"
```

Hallazgo real y reproducible de la auditoría `v2.2.0-66 → v2.3.0`:
`"aoi:invariant-gate": "node scripts/sdd-lifecycle/invariant-gate.mjs"` — sin `--entity` y
sin `--exit-code`. Corrido tal como está escrito sale **2** con
`Error: provide --entity <WORKSPACE> or --facts-file <path>`; es decir, el atajo de npm no
audita: falla por uso. Las invocaciones de `.github/` sí llevan el flag y el `--entity`. La
diferencia entre esas dos superficies es exactamente lo que este paso existe para encontrar:
**una invocación documentada que nunca puede bloquear a nadie.**

### 13.3 Sondas conductuales

```bash
( cd "$WORK/head" && node scripts/sdd-lifecycle/behavioral-runner.mjs --emit )
```

Preguntá: **¿alguien las ejecuta contra un modelo, o sólo se generan?** Sondas que se generan
y nadie corre declaran conductas que ninguna corrida comprueba.

Contestalo con evidencia, no con impresión:

```bash
rg -n 'behavioral-runner|behavioral-probes' package.json .github/ docs/ scripts/ --glob '!*.test.mjs'
```

#### El runner: emitir y juzgar

Desde `v2.4.0` hay runner, y el reparto de costos es explícito:

| Paso | Comando | Costo |
| :--- | :--- | :--- |
| **Emitir** | `pnpm aoi:probes` → `--emit [dir]` | **0 tokens.** Escribe un prompt por sonda más un `index.json` |
| Responder | *(el harness, con un modelo)* | **Inferencia.** Es el único paso que la cuesta |
| **Juzgar** | `pnpm aoi:probes:judge <answers.json>` | **0 tokens.** Compara contra `expected`/`forbidden` |

El formato de respuestas es `{ "<id-de-sonda>": "<respuesta>", ... }`.

> [!IMPORTANT]
> **Una sonda sin respuesta FALLA, no se saltea.** Es el corazón del runner: si un silencio
> contara como aprobado, la corrida diría "25/25 conductas correctas" sin haber mirado
> ninguna. Un id en el archivo de respuestas que no sea sonda también falla — es la firma de
> respuestas de otra versión.

#### El techo de lo que el runner prueba

`expected` está **sobrecargado a propósito**: tiene que aparecer en el contexto de la fase Y
describir una respuesta. Esa doble obligación lo vuelve una condición **necesaria**, no
suficiente, y el reporte lo dice por escrito para que nadie lea "25/25" como más de lo que es:

- **Sí prueba:** que la respuesta no es una evasión, que lleva el porqué, y que contiene el
  patrón que la fase también contiene.
- **No prueba:** que el modelo haya **usado** la evidencia. Eso necesita un juez humano o
  adversarial, y cuesta inferencia.

**Si vas a reportar sondas, reportá el techo.** Un `pass` acota el espacio de respuestas
incorrectas; no lo cierra.

#### Una corrida no es una medición: reportá el `n`

Una sonda contestada **una vez** no distingue un fallo sistemático de una casualidad del modelo.
Medido el 2026-09-12: `verify-delegation` falló en la primera corrida —el modelo contestó
`/sdd-frame` sobre un contexto que dice `Hand off to **@integration-specialist**` **tres veces**—
y **las dos corridas siguientes contestaron bien**, citando la evidencia correcta.

Con `n=1` ese resultado se puede leer de dos maneras opuestas y no hay forma de elegir: *"la sonda
detectó un fallo de conducta"* o *"el modelo tuvo una mala pasada"*. Las dos son plausibles y la
segunda era cierta.

> [!IMPORTANT]
> **Corré cada sonda al menos dos veces, y reportá el `n` y la dispersión.** Un informe que dice
> *"23/25"* sin decir cuántas veces corrió cada sonda está reportando una muestra como si fuera
> una población. Y si el número cambia entre corridas, **eso es el dato**: significa que la
> conducta no es estable, que es más interesante que el promedio.
>
> El costo es inferencia y por eso no se hace siempre. Pero entonces decilo: *"n=1"* es una
> limitación honesta; presentarlo como un resultado, no.

#### Cuando el criterio se vuelve el problema: la línea que carga la decisión

La lente adversarial demolió la primera versión del juez con dos contraejemplos que **ningún patrón puede distinguir**:

```
"En vez de @triage-specialist, lo enruto a @functional-analyst."   ← enruta al PROHIBIDO
"Sin dudarlo, enruto a @functional-analyst en vez de @triage-specialist."
```

Las dos caen en el agente prohibido. En la primera, *"en vez de"* niega la mención **anterior** y la guardia lo leía como si negara la posterior; en la segunda, *"sin dudarlo"* no niega nada pero matcheaba la lista de negaciones. **Atribuir una negación a la mención correcta es análisis sintáctico, y un regex no lo hace.**

La salida no fue un patrón más listo. Fue **darle al juez una línea cuyo único trabajo sea cargar la decisión**:

```
DECISION: <la decisión, corta y afirmativa>
MOTIVO: <el porqué>
```

Si la respuesta trae `DECISION:`, el criterio (`expected`/`forbidden`) se evalúa **ahí** —una línea corta donde las negaciones no juegan— y la evasión y la longitud se siguen mirando sobre el texto completo. Sin esa línea, todo se evalúa sobre el texto completo, como antes.

Sigue sin ser una garantía: una `DECISION:` puede mentir. Pero mueve el ataque desde *"esquivar un regex"* hacia *"afirmar explícitamente lo incorrecto"*, que es un terreno mucho más chico **y auditable**.

> [!IMPORTANT]
> **Y un campo no puede hacer dos trabajos que se contradicen.** `expected` servía para dos cosas: describir la forma de una respuesta **y** probar que la doctrina sigue en el contexto de la fase. Para una sonda de sí o no la forma empieza con `^no\b`, que por definición no puede aparecer en medio de un texto — así que las dos obligaciones se peleaban. La evidencia que el contexto tiene que seguir trayendo se declara aparte, en `evidence`, y cuando no se la declara el criterio de respuesta hace de evidencia.

#### La otra mitad: lo que el juez pide tiene que ser lo que la sonda pide

Siete de las 25 sondas piden una respuesta **corta y explícita**: *"Respondé con una sola palabra"*, *"Respondé con el número"*, *"Respondé con el estado"*, *"solo con el nombre del agente"*. El juez les exigía **12 caracteres**, así que reprobaba `critical` (8), `300` (3) y `Archivado` (9).

Es peor que un falso positivo: **es el instrumento contradiciendo a la sonda que dice juzgar.** Un juez que reprueba la respuesta que su propia pregunta pide no está midiendo conducta, está midiendo su propia rigidez.

Las siete se declaran en `SHORT_PROBES`, un mapa revisado con la frase del escenario que lo justifica —el mismo criterio que `SKILL_SCOPE`: *"Applicability is written down HERE rather than inferred"*— y hay una compuerta que **falla si una sonda pide una respuesta corta y no está en la lista**. Sin esa compuerta, la próxima sonda que pida "el número" reintroduce la contradicción en silencio.

#### La trampa que este paso ya cometió

Dos de las 25 sondas tenían un criterio que aprobaba **la palabra "no"** en cualquier
respuesta — incluido `"No se."` y una respuesta **invertida** como *"No hay problema,
salteala"*. Lo encontró el control negativo del runner, no una lectura: el runner habría
reportado *"25/25 conductas correctas"* sobre respuestas que no decidían nada.

Viene de la sobrecarga: para pasar el test de evidencia el patrón tiene que estar en la prosa,
y la prosa usa "no"; entonces el patrón terminó midiendo la palabra y no la decisión. Hay dos
compuertas permanentes en `behavioral-runner.test.mjs` que lo impiden volver:

- `ninguna sonda aprueba una evasión` — batería de 10 no-respuestas contra las 25 sondas.
- `ninguna sonda aprueba una respuesta sustantiva pero INCORRECTA` — el caso difícil: larga,
  con porqué, y que decide al revés. Ésa es la que sobrevive al primer filtro.

> [!WARNING]
> Las sondas se escriben en `/tmp/aoi-probes` por defecto. Si vas a comparar respuestas entre
> corridas, copiá el `index.json` afuera antes del próximo reinicio: ver A.4.

---

## 14. Fase 13 — La corrida real sobre una instalación

> [!IMPORTANT]
> **Ninguna medición en worktree reemplaza esto.** Dos defectos de esta auditoría sólo
> aparecieron acá y eran invisibles desde el repositorio.

> [!CAUTION]
> **Modificar el protocolo OBLIGA a correr esta fase.** El protocolo es prosa ejecutable
> sobre el producto; un cambio suyo que no se prueba sobre una instalación real es una
> hipótesis, no una mejora. Si tocaste una sola línea del protocolo, esta fase es
> obligatoria — y si no la corrés, **decilo en el informe**, no lo omitas.
>
> Vale igual para un cambio en un instrumento, en un gate o en `setup.sh`: el worktree mide
> el repositorio, y el repositorio no es lo que se entrega.

### 14.1 Preparar

```bash
TESTS="/Users/equinox/Desktop/AOI TESTS"   # el workspace de pruebas designado — el de 2.0

# Punto de restauración ANTES de tocar nada
( cd "$TESTS" && git add -A && git commit -q -m "chore: punto de restauración antes de auditar" )
```

Comprobá primero que los cambios locales de ese workspace no tengan nada único. **Esto no es
un chequeo de trámite: es la última red antes de pisar trabajo ajeno.** Un workspace de pruebas
acumula corridas, y una de esas corridas pudo dejar algo que sólo existe ahí:

```bash
( cd "$TESTS" && git status --short )

# Compará BYTE A BYTE contra el repo de desarrollo, contra el COMMIT, no contra el
# working tree: el working tree del repo tiene tus propios cambios sin commitear y
# compararse contra sí mismo siempre da "idéntico".
DEV="<RUTA_DEL_REPO_AOI>"
for f in $( cd "$TESTS" && git diff --name-only ); do
  if git -C "$DEV" show "HEAD:$f" > /tmp/aoi-dev-ver 2>/dev/null && cmp -s /tmp/aoi-dev-ver "$TESTS/$f"; then
    echo "ya está en dev    $f"
  else
    echo "*** ÚNICO — NO PISAR *** $f"
  fi
done
rm -f /tmp/aoi-dev-ver
```

| Resultado | Qué hacer |
| :--- | :--- |
| Todos "ya está en dev" | El workspace es reaplicación de trabajo ya versionado. Seguí. |
| Aparece algún "ÚNICO" | **Pará.** Traelo al repo de desarrollo o registralo en el informe antes de instalar, o `setup.sh` lo va a sobrescribir. |

> [!WARNING]
> El "punto de restauración" del bloque de arriba commitea esos cambios **como están**, así
> que protege el contenido — pero no lo trae al repo. Un commit de restauración no es un
> rescate: es una foto. Si hay trabajo único, el rescate se hace aparte y primero.

### 14.2 Instalar y correr el protocolo

```bash
( cd "<RUTA_DEL_REPO_AOI>" && bash setup.sh -y --harness all "$TESTS" )

cd "$TESTS"
node scripts/scaffold/validate-scaffold-parity.mjs | tail -1
node scripts/mcp-gateway/setup-mcp-gateway.mjs --signatures ; echo "EXIT=$?"
node scripts/aoi-doctor.mjs | rg 'Diagnostic Summary'
node --test "scripts/**/*.test.mjs" 2>&1 | tail -7
node scripts/sdd-lifecycle/sdd-stress-suite.mjs
node scripts/sdd-lifecycle/cache-prefix.mjs | rg -i 'huella|PISO:'
```

**Corré `setup.sh` dos veces** sobre el mismo destino: si el resultado no cambia, la
idempotencia queda ejercitada de paso y es un dato del informe. Compará el **conjunto de
archivos**, no sólo el conteo:

```bash
snap() { find . -path ./node_modules -prune -o -path ./.git -prune -o -type f -print | sort; }
( cd "$TESTS" && snap > /tmp/aoi-before.txt )
( cd "<RUTA_DEL_REPO_AOI>" && bash setup.sh -y --harness all "$TESTS" >/dev/null )
( cd "$TESTS" && snap > /tmp/aoi-after.txt )
diff /tmp/aoi-before.txt /tmp/aoi-after.txt && echo "idempotente" || echo "DIFIERE: ver A.13"
rm -f /tmp/aoi-before.txt /tmp/aoi-after.txt
```

### 14.3 Qué comparar entre repositorio e instalación

| Comparación | Qué significa si difieren |
| :--- | :--- |
| Piso por ciclo | **Deben coincidir.** Si no, la instalación no refleja el código auditado |
| Huella de masa repetida | **Debe coincidir.** Es la prueba byte a byte de que la banda ×6 es la misma |
| Cantidad de tests | Puede diferir legítimamente: hay tests que sólo prueban al instalador y no se envían. **Explicá la diferencia con nombres, no la ignores** |
| Fidelidad del payload | La instalación suele tener artefactos reales que el repositorio no. Fases que allá eran `fixture` o `skipped` acá se miden de verdad |
| **Conjunto de archivos gobernados** | **Es la fila que nadie hacía, y la más importante.** Ver 14.3.1 |

#### 14.3.1 La paridad NO puede comparar dos árboles

El renglón "Paridad" decía *"la instalación puede gobernar algún archivo más. Verificá cuál"*
sin decir cómo, y el resultado previsible es que nadie lo verifique nunca. Los baselines
registrados lo prueban: uno anotaba `322/322` en la instalación contra `320/320` en el
repositorio, con una diferencia de **dos archivos que jamás se explicó**.

**Por qué la compuerta no lo ve:** `validate-scaffold-parity` compara la raíz contra su espejo
`scaffold/` **dentro del mismo árbol**. Si un archivo está en los dos lados, la compuerta está
verde — aunque ese archivo no exista en la fuente de verdad. Un archivo presente en ambos
lados y ausente del repositorio es **invisible por construcción**. Las dos instancias dan su
propio `OK` sobre conjuntos distintos, y la resta entre ellos no la hace nadie.

Hacela vos:

```bash
node -e '
import("./scripts/scaffold/validate-scaffold-parity.mjs").then(async (m) => {
  const { DEFAULT_SYNC_PATHS, collectFilePaths } = m
  const fs = await import("node:fs"); const path = await import("node:path")
  const list = (root) => {
    const out = []
    for (const p of DEFAULT_SYNC_PATHS) {
      const full = path.join(root, p)
      if (!fs.existsSync(full)) continue
      if (fs.statSync(full).isFile()) { out.push(p); continue }
      for (const r of collectFilePaths(root, p)) out.push(r)
    }
    return out.sort()
  }
  const A = process.argv[1], B = process.argv[2]
  const a = list(A), b = list(B)
  const onlyB = b.filter((x) => !a.includes(x)), onlyA = a.filter((x) => !b.includes(x))
  console.log("repo:", a.length, " instalacion:", b.length)
  console.log("=== SOLO en la instalacion (trabajo que el repo no tiene) ===")
  onlyB.forEach((x) => console.log("  +", x))
  console.log("=== SOLO en el repo (la instalacion no lo recibio) ===")
  onlyA.forEach((x) => console.log("  -", x))
})' "<RUTA_DEL_REPO_AOI>" "$TESTS"
```

`collectFilePaths` devuelve rutas **ya relativas a la raíz**: no las vuelvas a prefijar.

| Resultado | Lectura |
| :--- | :--- |
| `+ X` (sólo en la instalación) | **Esperado por diseño** (paso 2.0.1): `$TESTS` es el hogar del ciclo. Reportalo con los archivos nombrados, no como alarma — salvo que además un ciclo **cerrado** quede sin dueño declarado, y eso sí se reporta. |
| `- X` (sólo en el repo) | **Hallazgo.** `setup.sh` no lo está distribuyendo. Es un defecto del instalador. |
| Ninguno | Los dos árboles gobiernan el mismo conjunto. |

> [!IMPORTANT]
> Un `+` **no** significa que la instalación está mal. Significa que la paridad no puede
> contestar la pregunta y por lo tanto la contesta el auditor. En la corrida del 2026-09-12
> aparecieron dos archivos de dashboard (`server/utils/token-budget.ts` y su test) que existen
> sólo en el workspace de pruebas: el hallazgo no es ni "la instalación sobra" ni "el repo
> falta", es que **nadie lo había mirado en dos ciclos**. Después se verificó que son los
> entregables de `TASK-2026-101`, y que su lugar es `$TESTS` — ver 2.0.1.

#### 14.3.2 Un test que lee `docs/` se rompe en la instalación

`docs/` **no se envía** a una instalación. Cualquier test que abra un archivo de ahí obtiene
`null` o `ENOENT`, y en el repositorio pasa verde. La compuerta puede estar bien —con su split
estricto/laxo— y el **test** romperse igual:

```
TypeError: Cannot read properties of null (reading 'replace')
    at gate-exit-codes.test.mjs
```

Reproducido en la instalación del 2026-09-12: suite del repositorio **821 pass · 0 fail**,
suite de la instalación **758 pass · 1 fail**, y el fallo era este. Lo vio **sólo** la Fase 13.

La forma correcta, y es la que ya usa `zero-input-verdicts.test.mjs`:

```javascript
it('...', (t) => {
  if (!fs.existsSync(path.join(REPO, 'setup.sh'))) {   // o el archivo puntual que lee
    t.skip('workspace instalado: docs/ no se envía, no hay nada que mutar')
    return
  }
  // ...
})
```

**El skip tiene que estar en el test, no sólo en la compuerta.** Un gate con split
estricto/laxo y un test sin él es la mitad de un arreglo.

### 14.4 Registrar la línea base

El resultado de esta corrida **es la línea base contra la cual se compara el ciclo siguiente**.
Anotala en el protocolo de verificación del repositorio con:

- el `git describe --tags` de lo instalado;
- piso, techo, banda ×6 y huella;
- payload base → optimizado, con la fidelidad por fase;
- paridad, suite, doctor y compuertas;
- **el diff de conjuntos de archivos de 14.3.1 y el veredicto de los skips nombrados**;
- **la fecha**, y si el instrumento llevaba cambios sin commitear, decilo: un install desde un
  árbol sucio no es reproducible desde un tag y así hay que etiquetarlo.

---

## 15. Fase 14 — Redacción del informe

### 15.1 Sello obligatorio

Encabezá el informe con una tabla de los dos extremos en forma `git describe --tags`, sus SHA
completos y sus fechas. Si el tag no apunta al commit auditado, **decilo explícitamente**.

### 15.2 Estructura mínima

1. Veredicto en tres frases.
2. Piso y techo por fase, tabla completa.
3. La descomposición de cuatro términos, con la suma de control visible.
4. El renglón [C] abierto: qué es contabilidad y qué es conducta.
5. La comparación honesta, con los dos números.
6. La banda ×6 contra la masa en disco, con la tolerancia del 10% declarada explícitamente.
7. La masa que ningún instrumento cuenta (paso 6.5), como renglón de alcance — **nunca
   sumada al piso**.
8. Instrumentación: qué no existía en la versión vieja, y qué corrió el bucle de 8.2 contra
   los 24 pasos de `pnpm test` (paso 8.4).
9. Resultado de `pnpm aoi:mutation`, con el piso por área y qué áreas quedaron sin ratchet.
10. Herramientas obligatorias: instalador y cableado.
11. Payload, con la advertencia de comparabilidad.
12. Hallazgos, cada uno con `proof` reproducible. *Un `proof` es un comando que otro corre y
    ve el mismo resultado. "Lo revisé" no es un `proof`.*
13. **Alcance no cubierto**, con el mismo nivel de detalle que lo cubierto.
14. **Sello de auto-auditoría**: la salida de `aoi:audit-protocol` (paso 16.1). Si el
    protocolo que produjo este informe no pasaba su propia compuerta, decilo acá.

### 15.3 Honestidad sobre el alcance

> Si una parte de la auditoría no se hizo, **listala con la misma precisión que lo que sí se
> hizo**. Un informe que omite su propio alcance se lee como completo y no lo es. Y si la
> auditoría se apoyó en agentes que fallaron, decilo: un hallazgo verificado a mano y uno
> verificado por tres lentes adversariales no tienen el mismo peso.

---

## 16. Fase 15 — Arreglos, en una rama aparte

**El informe describe un estado; la rama lo cambia.** Mezclarlos hace que el informe deje de
describir la versión que dice haber medido.

```bash
git checkout -b fix/auditoria-<fecha>
```

Para cada arreglo:

1. **Cerrá el defecto.**
2. **Agregá una compuerta determinista que impida que vuelva** — un test, no una nota.
3. **Dale control negativo a la compuerta**: armale el escenario del defecto y comprobá que
   lo detecta. Una compuerta que nunca vio el defecto no prueba nada.
4. **Verificá que el piso no se movió** (o reportá cuánto se movió y por qué).
5. **Espejá al scaffold** todo archivo en ruta gobernada, o la paridad falla.
6. Anotá en la tabla de hallazgos del informe en qué rama se resolvió cada uno.

Antes de cada commit:

```bash
node --test "scripts/**/*.test.mjs" 2>&1 | tail -6
node scripts/scaffold/validate-scaffold-parity.mjs | tail -1
node scripts/scaffold/validate-srp.mjs | tail -1
```

### 16.1 El protocolo se audita a sí mismo

Un protocolo que exige compuertas para todo lo que él mismo toca y no tiene ninguna es la
misma forma de falso verde que persigue: **verde sobre nada**. Hasta `v2.3.0` esto era
literal — se podía renombrar `scripts/multi-harness/cache-guard.mjs` en una copia aislada y
`reference-integrity` seguía imprimiendo *"Every reference resolves"*, porque sólo lintea
referencias del tipo `node scripts/<archivo>.mjs` y el protocolo escribe **24 de sus rutas
desnudas**, sin `node` adelante, dentro de los bucles de compuertas. Medido, no supuesto.

Desde `v2.4.0` hay una compuerta y **es el paso 0 y el último paso**:

```bash
node scripts/multi-harness/audit-protocol-integrity.mjs
```

Verifica cinco cosas, todas deterministas y con 0 tokens de inferencia:

| # | Qué verifica | El defecto que habría cazado |
| :--- | :--- | :--- |
| 1 | Toda ruta `scripts/**.mjs` nombrada existe, con o sin `node`, con o sin prefijo de worktree | La ruta desnuda que sobrevivía verde |
| 2 | Todo símbolo que el protocolo atribuye a un módulo está exportado ahí (lee el fuente, **nunca importa**) | `mirror`/`runGate`/`withViolation` no eran importables |
| 3 | La versión del encabezado coincide con la que anuncia `docs/README.md` | La versión duplicada que deriva |
| 4 | Existe una sola copia del protocolo en todo el árbol | La tercera copia que nadie gobierna |
| 5 | Verificó algo: cero rutas encontradas es un fallo | El verde sobre cero entradas |

**Cómo se extiende** — y esto es obligatorio, no una sugerencia: cuando agregues un
instrumento, un símbolo o una bandera al protocolo, agregalo también a la tabla de contratos
de la compuerta. Una instrucción que la compuerta no puede ver es una instrucción que va a
derivar.

```bash
# 1. Editá SYMBOL_CONTRACTS en scripts/multi-harness/audit-protocol-integrity.mjs
# 2. Verificá que el control negativo sigue cazando
node --test scripts/multi-harness/audit-protocol-integrity.test.mjs
```

> [!IMPORTANT]
> **`audit-protocol-integrity` NO es una compuerta que se pueda aprobar por ausencia.** En un
> workspace instalado `docs/` no se envía, así que sale 0 con un mensaje explícito — el mismo
> split estricto/laxo de `validate-srp` y `validate-test-globs`. En el repositorio de
> desarrollo, la ausencia del protocolo **es** un fallo. No la "arregles" volviéndola verde
> en los dos lados.

---

## Apéndice A — Trampas conocidas del instrumental

Cada una de estas costó tiempo o casi produjo un hallazgo falso.

### A.1 `git log -1 <sha>` puede devolver el commit equivocado

Con el proxy RTK activo devolvió el **padre**. Usá `git show -s --format='%H | %ad | %s'` y
cruzá con `git rev-parse`.

### A.2 `rg` puede devolver vacío donde hay coincidencias

Pasó dos veces en esta auditoría y casi produce un hallazgo falso de «componente huérfano».
**Regla: si `rg` devuelve vacío y la conclusión importa, confirmá con `node`:**

```javascript
import fs from 'node:fs'
// …recorrer el árbol y usar String.prototype.includes, que no miente
```

Además, `rg` acá **no acepta `--type-add`**, y patrones con `|` a veces se procesan mal.
Preferí `rg -n 'patrón' ruta` simple.

### A.3 `new URL(import.meta.url).pathname` se rompe con espacios en la ruta

La ruta del repositorio contiene un espacio y el `pathname` trae `%20`, así que
`fs.existsSync` falla en silencio y el test pasa por la razón equivocada. **Usá siempre
`fileURLToPath`:**

```javascript
import { fileURLToPath } from 'node:url'
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
```

### A.4 Los directorios temporales del harness se vacían entre sesiones

Los worktrees y los scripts auxiliares pueden desaparecer a mitad de la auditoría. Guardá los
sellos `git describe` en un archivo del repositorio, no en el scratchpad, y recreá los árboles
con los mismos SHA si hace falta.

### A.5 Un `git rm` queda en el índice y se cuela en el commit siguiente

Si borrás un archivo con `git rm` y después hacés `git add` de otra cosa y commiteás, la
eliminación viaja con ese commit. Revisá con `git show --stat --format='' HEAD` antes de
seguir, y si se coló, `git reset --soft HEAD~1 && git reset`.

### A.6 El gate de SRP corta en 300 LOC y los tests cuentan

Si agregás casos a un archivo de test que ya está cerca del límite, la compuerta falla. Es
señal de que corresponde un archivo nuevo, no de que la compuerta moleste.

### A.7 Un gate en modo «lenient» puede tener razón

Antes de reportar un falso verde, **leé si el gate distingue deliberadamente dos modos**. Uno
de ellos tolera lo que el otro prohíbe, y esa tolerancia puede estar bien fundada. En esta
auditoría un «crítico» se redujo a una contradicción cosmética por leer eso a tiempo.

### A.8 No inyectes fallas en el árbol de trabajo

Ni para probar un gate. Copiá el repositorio a un directorio descartable. El patrón está en
`gate-exit-codes.test.mjs`.

### A.9 El glob `**` no significa lo mismo en bash que en zsh

Ésta es la trampa que más silenciosamente rompe el protocolo en otro harness, porque **no da
error: da menos**.

| Shell | `scripts/**/*.test.mjs` encuentra |
| :--- | ---: |
| zsh | 86 archivos |
| bash 3.2 (macOS) o bash sin `globstar` | **81 archivos** |

En bash, `**` se comporta como `*`, así que el patrón sólo alcanza un nivel de profundidad y
**cinco archivos de test desaparecen sin que nada lo avise**. Un agente que corre el protocolo
desde bash reporta una suite verde más chica y no lo nota. Es exactamente el falso verde que
esta auditoría persigue, cometido por el protocolo mismo.

**La forma portable es entrecomillar el patrón** y dejar que Node lo expanda:

```bash
node --test "scripts/**/*.test.mjs"     # ✅ encuentra el mismo conjunto en bash y en zsh
node --test scripts/**/*.test.mjs       # ❌ depende del shell
```

> No pongas el número de tests en el comentario: cambia con cada commit y convierte una nota
> útil en una nota vieja. Contá, no cites.

Verificalo en tu entorno antes de confiar en cualquier conteo de tests:

```bash
echo "zsh : $(zsh  -c 'ls scripts/**/*.test.mjs 2>/dev/null | wc -l')"
echo "bash: $(bash -c 'ls scripts/**/*.test.mjs 2>/dev/null | wc -l')"
```

Si los dos números difieren, tu shell no soporta `globstar` y **todo conteo de archivos que
hagas con `**` sin comillas está mal**.

### A.10 Comandos auxiliares y portabilidad POSIX (`timeout`, `fd`, `md5` vs `cmp`)

Diferentes sistemas operativos y harnesses ejecutan en shells con distintos comandos instalados:
- **`timeout`**: Es parte de GNU Coreutils. En macOS vanilla sin Homebrew no existe de forma nativa. Todo script del protocolo que invoque `timeout` debe verificar su existencia (`command -v timeout >/dev/null 2>&1`) o ejecutar el comando directamente para no generar un falso fallo instrumental.
- **`fd`**: Es un binario externo (`fd-find`). Si el entorno no lo tiene, el equivalente universal POSIX es `find "$DIR" -name "*$PATTERN*"`.
- **`md5` vs `cmp`**: macOS y BSD usan `md5 -q "$f"`, mientras que Linux usa `md5sum "$f"`. Para comprobar si dos archivos son byte-idénticos de forma 100% portable y en 0 tokens, usá la primitiva POSIX `cmp -s "$a" "$b"`.
- **`rg`**: No es POSIX ni viene en un macOS recién instalado. Si falta, `grep -rn` cubre los usos de este protocolo — pero acordate de A.2 antes de creerle a un vacío.

### A.11 El fallback `||` re-ejecuta la compuerta que falló

Un idiom tentador y equivocado, que estaba en el bucle de la Fase 7 hasta `v2.3.0`:

```bash
# ❌ MAL
out=$( (command -v timeout >/dev/null 2>&1 && timeout 180 node "$f" || node "$f") 2>&1 ); code=$?
```

`||` no distingue **"`timeout` no está instalado"** de **"la compuerta falló"**. Con `timeout`
presente y una compuerta que sale 1, el fallback la corre **otra vez**, y el código que
terminás reportando es el de la segunda corrida. Medido:

```bash
printf 'console.log("EJECUTADA")\nprocess.exit(1)\n' > /tmp/demo.mjs
out=$( (command -v timeout >/dev/null 2>&1 && timeout 180 node /tmp/demo.mjs || node /tmp/demo.mjs) 2>&1 )
echo "$(echo "$out" | grep -c EJECUTADA) veces ejecutada"   # -> 2
```

Dos consecuencias, y la segunda es peor que la primera: el costo se duplica en cada roja —en
una auditoría con varias rojas, eso es la mitad del presupuesto de CPU— y si la compuerta se
**cuelga**, el `timeout` la mata y el fallback la vuelve a lanzar **sin timeout**, colgando la
auditoría entera. Un protocolo que persigue falsos verdes no puede tener un falso rojo que se
re-ejecuta solo.

La forma correcta es un `if`, no un `||`:

```bash
# ✅ BIEN
if command -v timeout >/dev/null 2>&1; then
  out=$( cd "$ROOT" && timeout 180 node "$f" 2>&1 ); code=$?
else
  out=$( cd "$ROOT" && node "$f" 2>&1 ); code=$?
fi
```

> Vale para cualquier `cmd || fallback` donde `cmd` pueda fallar **por el motivo que estás
> midiendo**. El `||` es para alternativas, no para diagnósticos.

### A.12 `Math.ceil(len/4)` no es el estimador del instrumento

El instrumento usa `Math.round(len/4)` (`estimateTokens` en
`scripts/sdd-lifecycle/token-accounting.mjs`). Un contraste escrito con `Math.ceil` arranca
con un sesgo de hasta +1 token por archivo, y en un árbol de 75 archivos son ~75 tokens de
diferencia que después hay que explicar en la verificación cruzada del paso 6.3.

**Importá el estimador, no lo reescribas:**

```javascript
import { estimateTokens } from '<RUTA_DEL_REPO_AOI>/scripts/sdd-lifecycle/token-accounting.mjs'
```

> Regla general: si el protocolo y el instrumento tienen que coincidir en un número, tienen
> que compartir el código que lo produce. Dos implementaciones del mismo cálculo divergen
> siempre; la pregunta es cuándo.

### A.13 Dos formas de medir "no cambió", y sólo una sirve

El paso 14.2 pide correr `setup.sh` dos veces y comparar. **Comparar conteos no prueba
idempotencia.** Dos corridas pueden dar `1280` y `1280` con archivos distintos adentro, y un
`wc -l` no lo distingue. Lo que se compara es el **conjunto**:

```bash
# ❌ dice "1280 = 1280" y no prueba nada
ls -R "$TESTS" | wc -l

# ✅ dice qué archivo apareció y cuál desapareció
( cd "$TESTS" && find . -path ./node_modules -prune -o -type f -print | sort ) > /tmp/a.txt
( cd "$TESTS" && find . -path ./node_modules -prune -o -type f -print | sort ) > /tmp/b.txt
diff /tmp/a.txt /tmp/b.txt
```

Y el conjunto de **nombres** tampoco prueba idempotencia: un archivo reescrito con otro
contenido conserva su nombre. Si querés lo segundo, compará con `cmp -s`:

```bash
for f in $(cd "$TESTS" && git ls-files); do
  cmp -s "$SNAP/$f" "$TESTS/$f" || echo "contenido distinto: $f"
done
```

**La excepción conocida y legítima** son los artefactos de instalación que registran la
corrida: `.conf/history.jsonl` acumula una línea por instalación, y `.conf/manifest.json`
refresca `updated_at`. Su cambio es el resultado esperado, no una falla de idempotencia.
Nombrálos en el informe en vez de dejar que ensucien el diff.

> Medido en la corrida del 2026-09-12: `setup.sh` dos veces sobre el mismo destino dio el
> mismo conjunto de 1280 archivos. La idempotencia quedó ejercitada.

### A.14 Un resultado de `rg` cortado por el ancho del terminal no es un dato

`rg` no corta líneas: las corta el **terminal** al mostrarlas. Si leés el resultado de un `rg`
en la salida del agente o en una consola angosta, una coincidencia puede aparecer partida, y
el fragmento visible **parece** el valor.

Costó un hallazgo falso en la auditoría del 2026-09-12. Buscando el tag del contrato se
imprimió:

```
payload-md.txt:- `l:never.1 never reports ok when used exceeds limit`
```

y se anotó en el informe que los tags viajaban mutilados como `l:never.1` — con la
conclusión de que la coincidencia del gate era *casual y no estructural*. **El archivo decía
`BIC-2026-001:never.1`.** Lo que se leyó fue la cola de esa cadena tras un corte por ancho.

> [!CAUTION]
> **Un hallazgo que depende de un valor parcial no se escribe hasta verlo entero.** Verificalo
> con un comando cuyo resultado no pueda partirse:
>
> ```bash
> rg -n 'l:never' "$DIR"                    # ¿existe el valor mutilado? (vacío = no existe)
> rg -o '[A-Za-z0-9-]*:never\.[0-9]+' "$DIR" | sort | uniq -c   # el valor completo, contado
> ```
>
> La segunda forma es la que sirve: extrae **sólo** el token que importa, sin contexto que
> pueda cortarse, y lo cuenta. Un `uniq -c` sobre el token completo es imposible de
> malinterpretar; una línea de `rg` en una consola angosta, no.

Esto es una variante de A.2, con una diferencia que la hace peor: A.2 produce un **vacío** que
uno desconfía. Ésta produce un **valor con forma de dato**, y el sesgo de confirmación hace el
resto. Si el fragmento respalda algo que ya sospechabas, sospechá el doble.

### A.15 En AOI, formatear es un cambio de producto

Un "Format Document" del editor no es cosmético acá, y el 2026-09-12 lo demostró rompiendo
cuatro cosas de golpe, ninguna visible hasta correr las compuertas:

| Qué rompe | Por qué | Medido |
| :--- | :--- | :--- |
| **Paridad** | Se formatea la raíz y no los espejos de `scaffold/` | 11 `CONTENT_MISMATCH` |
| **SRP** | El reflow **expande** el código y el límite son 300 LOC | `invariant-gate.test.mjs` 245 → 341 |
| Tests en cascada | Los dos anteriores | suite 829 → 827 pass · 2 fail |
| Docs legibles | Prettier **alinea las tablas markdown** con relleno | filas de 1122 caracteres, con runs de ~900 espacios |

**La regla:** si hay que formatear, es un **cambio propio**, con la config fijada, **espejado a
`scaffold/`** y con verificación completa. Nunca mezclado en una rama de auditoría — el diff se
vuelve ilegible y los hallazgos se pierden entre el ruido.

El repo trae `.prettierrc` (estilo fijado: 80 columnas, sin punto y coma, comillas simples) y
`.prettierignore`, cuya parte que **carga el peso** es:

```
scaffold/     # contenido espejado: se regenera copiando, no formateando.
              # Ignorarlo hace que formatear la raíz deje la paridad ROJA, que es
              # lo que se quiere: un error visible en vez de un commit silencioso.
*.md          # la prosa es de formato manual. Un formateador de CÓDIGO no tiene
              # por qué tocar documentos.
```

> [!WARNING]
> **Nada de esto reemplaza a las compuertas.** La paridad y el SRP son los que detectan el
> daño; la config sólo evita que el daño sea arbitrario. Y si tu editor no tiene Prettier
> instalado en el proyecto —acá no está en `node_modules`— la config sólo gobierna la extensión
> del editor, que es exactamente de donde salió el accidente.

---

### A.16 Un instrumento que mide un proceso vivo no es reproducible

Un benchmark que dice *"aritmética estática sobre archivos en disco, 0 tokens de inferencia"*
puede ser **no determinista igual**, y no por los archivos. Medido el 2026-09-12 en
`sdd-stress-suite.mjs`: el mismo comando sobre el mismo árbol daba `5844 -> 1051` y después
`5845 -> 1052`, con el payload oscilando entre 4.683 y 4.684.

**La causa.** La Fase 3 no mide sólo archivos: corre `node --test` de verdad y **mide su
salida**. Y esa salida cambia entre corridas por **tres** razones independientes:

| Fuente | Cómo aparece | Regla |
| :--- | :--- | :--- |
| Duración por test | `✔ passes (0.51675ms)` | `/\(\s*\d+(?:\.\d+)?\s*ms\s*\)/g` → `(0ms)` |
| Duración del resumen | `ℹ duration_ms 55.907834` | `/(duration_ms\s*[:=]?\s*)\d+(?:\.\d+)?/g` |
| Directorio temporal | `/tmp/aoi-corpus-AUJDeG/red.test.mjs` | reemplazar la ruta o `aoi-corpus-XXXXXX` |

> [!CAUTION]
> **La segunda es la que casi se escapa, y enseña la lección.** La primera versión de la
> limpieza exigía un separador `:` o `=` después de `duration_ms`, y **el reporter usa un
> espacio**. La regla no matcheaba, la duración seguía entrando al cómputo, y la limpieza
> *parecía* completa porque ya no se veía la forma entre paréntesis.
>
> Y la tercera no cambia el **largo** del texto, así que un benchmark que mide caracteres no
> la detecta — pero hace que dos capturas nunca sean iguales byte a byte, y **una captura que
> no se puede comparar no sirve como evidencia**.

**Cómo se detecta, y va antes de cualquier comparación.** Corré el instrumento **dos veces
sobre el mismo árbol** y difará los números: si difieren, el instrumento no se reproduce y
nada de lo que construyas encima vale. `sort -u | wc -l` da 1 cuando sirve. Ver el paso 7.1.

Y la compuerta permanente: el test `dos capturas del mismo test son byte a byte idénticas` en
`real-corpus.test.mjs`. Es la que habría cazado esto el día uno, y la que impide que vuelva
cuando alguien agregue una fase que corra otro proceso.

> La regla general: **un instrumento que ejecuta algo y mide el resultado tiene que limpiar lo
> volátil antes de medir**, y tiene que tener un test que lo pruebe corriéndolo dos veces. El
> "0 tokens de inferencia" y el "aritmética estática" pueden ser ciertos los dos y no protegerte
> de nada: la propiedad que falta es la **reproducibilidad**, y es distinta.

---

### A.17 Una guardia vive en UNA rama, y un argumento de más la apaga

La verificación adversarial de esta auditoría encontró **seis** caminos por los que el Invariant Gate aprobaba sin haber leído nada. No fue leer código: fue ejecutarlo contra entradas que nadie prueba.

La forma general del defecto, que vale más que los seis casos: **una guardia escrita dentro de una rama protege esa rama y ninguna otra**. La comprobación de "¿extraje al menos una regla?" vivía en el `else` de la entidad inferida. Consecuencias medidas:

| Entrada | Antes | Por qué |
| :--- | ---: | :--- |
| `--facts-file` con tabla separada por **tabs** | SKIPPED 0 | `parseFactTable` sólo acepta `\S+\s{2,}` y **todos sus `continue` son silenciosos**: *no pude parsear* se reportaba como *no hay contrato* |
| `--facts-file` con formato `key: value` | SKIPPED 0 | Igual |
| `--facts-file` **vacío** | SKIPPED 0 | Igual |
| `--bic TYPO` sobre un contrato con reglas | SKIPPED 0 | Y con un mensaje **falso**: "No BIC contract facts found" |
| `--bic TYPO` (el peor) | SKIPPED 0 | La guardia se evaluaba sobre el conjunto **sin filtrar**. **Un argumento de más apagaba el fail-closed.** |
| Salida de ICM en formato inesperado | SKIPPED 0 | Distinguía `ok`/`no-ok`, nunca "¿cuántas reglas extraje?" |

**La pregunta correcta nunca fue *"¿el toolchain contestó?"* sino *"¿mi parser extrajo al menos una regla?"*.** Se responde una vez, después de parsear, y vale para los tres caminos de entrada. Es lo que el arreglo hace.

> [!CAUTION]
> **Un `continue` silencioso en un parser es una guardia que no existe.** Si el parser descarta una línea sin dejar rastro, el resultado no es "no pude leerlo": es "no hay nada", y ésas son dos cosas distintas con el mismo exit code. Todo parser que alimente una compuerta tiene que poder decir *cuántas entradas descartó y por qué*.

Y la lección de método: **los seis caminos salieron de ejecutar el gate contra entradas raras**, no de leerlo. Un test escrito por el autor del código prueba lo que al autor se le ocurrió; una lente con mandato de refutar prueba lo que el autor no quiso ver.

---

### A.18 Una lectura de reloj en un camino medido: invariante por aritmética, no por construcción

Ésta nació de refutarme a mí mismo, y lo que vale es que **la afirmación original era falsa**.

Yo había reportado que el `new Date()` de la Fase 5 del stress suite era *"una fuente de no-determinismo esperando su momento"*. Medido: **no mueve un solo número.** Tres fechas sobre el mismo árbol dan idénticas —`261 -> 32` en la Fase 5, `20.941 -> 4.595` en el total— porque `estimateTokens` es `Math.round(len / 4)` y `slice(0, 10)` tiene ancho fijo.

Y sin embargo **el hallazgo era real**: lo había nombrado mal. No era un defecto de reproducibilidad, era una **contradicción entre lo que el protocolo afirma (paso 7.2: el payload es función del árbol) y lo que el instrumento hace (leer el reloj dentro de la plantilla que mide)**. Que las dos cosas convivieran sin conflicto visible era una casualidad aritmética.

| | Qué decía | Qué es |
| :--- | :--- | :--- |
| Como lo reporté | *"fuente de no-determinismo latente"* | **Falso**: tres fechas, un solo número |
| Lo que era | *"entrada no-árbol dentro de un camino medido"* | **Cierto**, y sostenido por casualidad |

**Las dos lecciones.**

**1. Enumerá TODAS las fuentes, no la que encontraste.** `stripVolatile` necesitó tres reglas porque la primera versión cubrió una sola; acá pasa lo mismo. El método es un `rg` por las seis formas de leer el reloj sobre todo `scripts/` (paso 7.4). Medido: **29 archivos, 1 en un camino medido.** Los otros 28 son comportamiento legítimo y quedaron clasificados, no arreglados.

**2. Una invariante que se sostiene por aritmética no es una invariante.** El instrumento era correcto *porque* el estimador dividía por cuatro. Cambiar el estimador por un tokenizador real —una línea— habría metido el reloj dentro del número sin que nadie tocara la Fase 5. El arreglo no fue congelar la fecha: fue **inyectarla con guardia de ancho**, para que la masa no pueda depender del calendario con ningún estimador, y dejar cuatro casos de test que lo exijan.

> [!CAUTION]
> **"El número no se mueve" no es lo mismo que "el instrumento está bien".** Cuando una entrada viola lo que el instrumento declara medir, la pregunta no es si hoy se nota: es **qué la sostiene**. Si la respuesta es "una propiedad del estimador", no hay invariante.

---

## Apéndice B — Adaptación por harness



### B.1 GitHub Copilot

- Superficies que lee: `.github/instructions/` (según `applyTo`), `.github/prompts/`,
  `.github/agents/`, `.github/skills/`, `.github/copilot-instructions.md`.
- El piso estándar del instrumento **es** su factura. Los números del protocolo aplican
  directamente.
- Ejecutá los comandos desde el terminal integrado. No hay orquestación paralela: corré las
  fases en orden, una por una.
- Para la Fase 8 (falso verde) hay dos redes ya tejidas y las dos son mejores que la
  inyección artesanal: `pnpm aoi:mutation` pregunta **por línea** si algo la mira, y
  `gate-exit-codes.test.mjs` pregunta **por compuerta** si puede fallar. Corré la primera y
  agregá casos a la segunda sólo para lo que no esté en su lista. El instrumental para
  fabricar esos casos es `scripts/scaffold/failure-injection.mjs`, no una copia a mano.

### B.2 Antigravity

- Superficies que lee: `.agents/rules/`, `.agents/skills/`, `AGENTS.md`. **No lee
  `.github/instructions/`.**
- **Consecuencia directa para esta auditoría**: el piso que el instrumento publica **no es tu
  factura**. Corré siempre el paso 6.4 y reportá la banda de `.agents/skills` por separado.
  Una skill ahí puede pesar más a propósito, porque para este harness es el único lugar donde
  aparece la doctrina que otros reciben por instruction.
- Verificá que `compile-rules.mjs` haya **derivado** las skills de `.agents/` y no simplemente
  copiado las de `.github/`. La comprobación **sólo aplica a las skills que restan de una
  instruction**: si una skill no tiene instruction correspondiente, ser byte-idéntica es lo
  correcto y no un defecto. El script de abajo lo distingue solo.

```bash
for s in $(ls "$WORK/head/.github/skills") ; do
  a="$WORK/head/.github/skills/$s/SKILL.md"; b="$WORK/head/.agents/skills/$s/SKILL.md"
  [ -f "$a" ] && [ -f "$b" ] || continue
  # ¿Existe una instruction homónima de la que esta skill debería derivarse?
  instr="$WORK/head/.github/instructions/$s.instructions.md"
  [ -f "$instr" ] || instr="$WORK/head/.github/instructions/$s-protocol.instructions.md"
  igual=$(cmp -s "$a" "$b" && echo si || echo no)
  if [ -f "$instr" ]; then
    printf "%-24s %s\n" "$s" "$([ "$igual" = si ] && echo '❌ COPIADA — antigravity recibe el resumen recortado' || echo '✅ derivada')"
  else
    printf "%-24s %s\n" "$s" "$([ "$igual" = si ] && echo '· espejo (sin instruction que derivar: correcto)' || echo '? diverge sin instruction — investigar')"
  fi
done
```

Resultado esperado hoy: `icm` y `rtk` derivadas, el resto espejo. Cualquier otra combinación
merece explicación.

### B.3 Cualquier harness

- Todo este protocolo corre con `bash` + `node` **+ `rg`**. No requiere ninguna herramienta
  propietaria, pero decir "bash + node" y nada más es falso: hay pasos que usan `rg` (§5.1,
  §5.2, §8.3, §11.1, §13.1, §13.2), uno que usa `fd` con fallback a `find` (§5.1), y el bucle
  de §8.2 usa `timeout` si existe. Con `grep -rn` y `find` el protocolo corre igual — anotá
  cuál usaste, porque los conteos cambian de una herramienta a otra (ver A.2).
- Si tu harness ofrece orquestación paralela de subagentes, usala **sólo para las dimensiones
  cualitativas** (prompts, agentes, instalador, aplicación) y con verificación adversarial:
  cada hallazgo, refutado por lentes independientes antes de entrar al informe.
- **La medición cuantitativa hacela siempre vos, en serie.** Es determinista, es barata, y un
  subagente que se cae a mitad te deja sin el número.
- Si los subagentes fallan —límite de sesión, cuota, lo que sea— **el protocolo sigue siendo
  ejecutable a mano**. Está escrito para eso.

---

## Apéndice C — Checklist de cierre

Antes de dar la auditoría por terminada:

- [ ] Ambos extremos sellados con `git describe --tags` y SHA completo.
- [ ] El `$WORK` está en `$HOME/.aoi-audit-work/` y **el Escritorio quedó limpio** (paso 2.0).
- [ ] El diff de conjuntos repo↔`$TESTS` está reportado: cada `+ X` como **esperado por diseño**
      (paso 2.0.1) y **todo `- X` como hallazgo**. Ningún ciclo cerrado sin dueño declarado.
- [ ] Los dos worktrees verificados en el SHA que el informe rótula (paso 2.1).
- [ ] Los cambios locales de `$TESTS` se compararon contra el COMMIT de dev y no hay ninguno
      ÚNICO sin rescatar (paso 14.1).
- [ ] **Si se tocó una línea del protocolo, de un gate o de `setup.sh`: la Fase 13 se corrió.**
      Si no, está declarado en el alcance no cubierto, con esas palabras.
- [ ] El conjunto de archivos gobernados se comparó entre repo e instalación, y cada `+`/`-`
      tiene explicación (paso 14.3.1).
- [ ] Todo test que lee `docs/` tiene su skip para el workspace instalado (paso 14.3.2), y el
      skip está en el TEST, no sólo en la compuerta.
- [ ] La idempotencia se midió por conjunto de archivos, no por conteo (paso 14.2 + A.13).
- [ ] Los tres skips de la instalación están nombrados con su motivo.
- [ ] `aoi:audit-protocol` verde **antes** de la primera medición y **después** de los
      arreglos (§16.1).
- [ ] La suma de control de la descomposición cierra exactamente.
- [ ] Cada archivo del renglón [C] fue abierto y clasificado como contabilidad o conducta.
- [ ] El delta de la banda ×6 converge con el término [A] dentro del 10% declarado (paso 6.3).
- [ ] **El instrumento del payload se reproduce contra sí mismo**: dos corridas sobre el mismo
      árbol dan el mismo número (paso 7.1). Si no, el payload no se reporta.
- [ ] La fidelidad del payload está declarada: cuántas fases reales, cuántas fixture, cuántas
      omitidas.
- [ ] **Todas** las lecturas de reloj del camino medido están enumeradas, y ninguna alimenta un
      número sin guardia de ancho (paso 7.4 + A.18).
- [ ] La masa de prosa en disco está medida y contrastada contra el piso.
- [ ] La masa que ningún instrumento cuenta está medida y reportada como alcance, **no sumada
      al piso** (paso 6.5).
- [ ] Las dos bandas de harness están reportadas por separado.
- [ ] Todas las compuertas corrieron en ambos árboles, con su exit code, y ninguna se
      re-ejecutó por el fallback `||` (A.11).
- [ ] La lista de pasos que quedaron fuera del bucle 8.2 está declarada con nombres (paso 8.4).
- [ ] `pnpm aoi:mutation` corrió y se leyó qué áreas **no** tienen ratchet (paso 9.0).
- [ ] Toda compuerta tiene al menos un caso que la vio fallar.
- [ ] Cada herramienta obligatoria tiene una línea de invocación identificada.
- [ ] Cada invocación documentada de un gate con flag se corrió desnuda y su exit code está
      reportado (paso 13.2).
- [ ] Las sondas conductuales están clasificadas como generadas o ejecutadas, con la evidencia
      que lo prueba (paso 13.3).
- [ ] Cada recorte tiene su prueba de equivalencia, o está etiquetado como capacidad perdida.
- [ ] El Invariant Gate falla cerrado y sus invocaciones llevan el flag que bloquea.
- [ ] La corrida real sobre la instalación está hecha y registrada como línea base.
- [ ] Cada hallazgo tiene un `proof` que otro puede ejecutar.
- [ ] El alcance no cubierto está listado con el mismo detalle que lo cubierto.
- [ ] Los arreglos van en una rama aparte, cada uno con su compuerta y su control negativo.
- [ ] Todo instrumento o símbolo nuevo que el protocolo nombre quedó en la tabla de contratos
      de `audit-protocol-integrity` (§16.1).
