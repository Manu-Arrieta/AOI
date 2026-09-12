# Protocolo de Auditoría Comparativa de AOI

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

---

## 0. La regla que gobierna todo el protocolo

> **Un número que no se puede reproducir con un comando no entra en el informe.**

De ahí salen tres reglas operativas que no son negociables:

1. **Medí las dos versiones con EL MISMO instrumento**, el de la versión nueva. Medir cada
   versión con su propio medidor mezcla *ahorro real* con *corrección de medición*, y el
   resultado es un número verdadero que describe algo que no es.
2. **Separá el recorte del cambio contable.** Una caída del piso puede venir de prosa
   borrada o de prosa reclasificada. Las dos son legítimas, pero sólo una es ahorro.
3. **Verificá antes de afirmar.** Si tu conclusión se apoya en la salida de `rg`, `grep` o
   cualquier herramienta proxy, confirmala con un segundo método antes de escribirla. El
   Apéndice A lista los casos donde eso ya falló.

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

```bash
WORK="<directorio-temporal-fuera-del-repo>"
mkdir -p "$WORK"

git worktree add --detach "$WORK/base" "$BASE"
git worktree add --detach "$WORK/head" "$HEAD_SHA"
git worktree list
```

> [!IMPORTANT]
> Elegí un `$WORK` que **sobreviva a un reinicio de sesión**. Un directorio temporal del
> harness puede vaciarse entre turnos y perdés los árboles a mitad de la auditoría. Si eso
> pasa, recrealos con los mismos SHA: los sellos del paso 1.2 son justamente para eso.

Al terminar la auditoría:

```bash
git worktree remove --force "$WORK/base"
git worktree remove --force "$WORK/head"
git worktree prune
```

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
// Inmune a marcadores y a cambios del instrumento.
import fs from 'node:fs'
import path from 'node:path'

const est = (t) => Math.ceil(t.length / 4)
const walk = (d) => {
  const o = []
  if (!fs.existsSync(d)) return o
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) o.push(...walk(p))
    else if (e.name.endsWith('.md')) o.push(p)
  }
  return o
}
const SUP = ['.github/agents', '.github/prompts', '.github/instructions', '.github/skills', '.agents/skills']
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

Verificación cruzada: **el delta de la banda ×6 debería aproximarse al término [A] de la
descomposición.** Si coinciden, dos métodos independientes convergen y el resultado es sólido.

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

Qué sí es comparable: el **payload optimizado absoluto**. Si se mantiene prácticamente igual,
esa es la señal correcta de que el ciclo de trabajo tocó la **prosa fija** y no los mecanismos
de compresión. Anotá también la **fidelidad**: cuántas fases se midieron sobre artefactos
reales, cuántas sobre fixtures y cuántas se omitieron. Un porcentaje sobre fixtures es
representativo en proporción pero no en volumen.

---

## 8. Fase 7 — Instrumentación, compuertas y tests

### 8.1 Qué instrumentos existen en cada versión

```bash
for f in scripts/sdd-lifecycle/context-budget.mjs \
         scripts/sdd-lifecycle/cache-prefix.mjs \
         scripts/sdd-lifecycle/phase-handoffs.mjs \
         scripts/sdd-lifecycle/instruction-scope.mjs \
         scripts/sdd-lifecycle/phase-references.mjs \
         scripts/sdd-lifecycle/behavioral-probes.mjs \
         scripts/sdd-lifecycle/registry-sync.mjs \
         scripts/scaffold/validate-test-globs.mjs \
         scripts/scaffold/validate-srp.mjs \
         scripts/scaffold/source-reachability.mjs \
         scripts/multi-harness/validate-agent-routing.mjs \
         scripts/multi-harness/token-tool-coverage.mjs \
         scripts/multi-harness/install-hooks.mjs ; do
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
           scripts/sdd-lifecycle/phase-handoffs.mjs \
           scripts/sdd-lifecycle/cache-prefix.mjs \
           scripts/multi-harness/token-tool-coverage.mjs \
           scripts/sdd-lifecycle/registry-sync.mjs \
           scripts/multi-harness/reference-integrity.mjs \
           scripts/multi-harness/cache-guard.mjs ; do
    [ -f "$ROOT/$f" ] || { echo "  [--] $f (no existe)"; continue; }
    out=$( cd "$ROOT" && (command -v timeout >/dev/null 2>&1 && timeout 180 node "$f" || node "$f") 2>&1 ); code=$?
    echo "  [$code] $(basename $f) -> $(echo "$out" | tail -1 | cut -c1-90)"
  done
done
```

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

---

## 9. Fase 8 — Falso verde: la dimensión más cara

Una compuerta que nadie vio fallar es indistinguible de una que **no puede** fallar.

### 9.1 Cruzar la lista

Sacá la lista de compuertas que `pnpm test` corre y la lista de compuertas que algún test
ve **salir distinto de cero**. La diferencia es tu zona de riesgo.

```bash
rg -n 'runGate|notEqual' scripts/scaffold/gate-exit-codes.test.mjs | head -30
rg -n 'GATES' -A8 scripts/multi-harness/zero-input-verdicts.test.mjs
```

### 9.2 Inyectar la falla, siempre en copia aislada

> [!CAUTION]
> **Nunca inyectes fallas en el árbol de trabajo.** Copiá el repositorio a un directorio
> descartable, rompé ahí, medí, y borrá la copia. El patrón ya está implementado en
> `scripts/scaffold/gate-exit-codes.test.mjs` (funciones `mirror`, `runGate`, `withViolation`);
> reusalo en vez de escribir uno nuevo.

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

**Resultado esperado: exit distinto de cero en todas.** Si alguna sale 0, ese es un hallazgo
crítico. Si todas fallan como deben, el hallazgo es más chico pero igual real: *faltaba la
prueba*, y ahora existe.

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

### 13.3 Sondas conductuales

```bash
( cd "$WORK/head" && node scripts/sdd-lifecycle/behavioral-probes.mjs | tail -5 )
```

Preguntá: **¿alguien las ejecuta contra un modelo, o sólo se generan?** Sondas que se generan
y nadie corre declaran conductas que ninguna corrida comprueba.

---

## 14. Fase 13 — La corrida real sobre una instalación

> [!IMPORTANT]
> **Ninguna medición en worktree reemplaza esto.** Dos defectos de esta auditoría sólo
> aparecieron acá y eran invisibles desde el repositorio.

### 14.1 Preparar

```bash
TESTS="/Users/equinox/Desktop/AOI TESTS"   # el workspace de pruebas designado

# Punto de restauración ANTES de tocar nada
( cd "$TESTS" && git add -A && git commit -q -m "chore: punto de restauración antes de auditar" )
```

Comprobá primero que los cambios locales de ese workspace no tengan nada único:

```bash
( cd "$TESTS" && git status --short )
# y para cada archivo modificado, comparar md5 contra el repo de desarrollo
```

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
idempotencia queda ejercitada de paso y es un dato del informe.

### 14.3 Qué comparar entre repositorio e instalación

| Comparación | Qué significa si difieren |
| :--- | :--- |
| Piso por ciclo | **Deben coincidir.** Si no, la instalación no refleja el código auditado |
| Huella de masa repetida | **Debe coincidir.** Es la prueba byte a byte de que la banda ×6 es la misma |
| Cantidad de tests | Puede diferir legítimamente: hay tests que sólo prueban al instalador y no se envían. **Explicá la diferencia con nombres, no la ignores** |
| Fidelidad del payload | La instalación suele tener artefactos reales que el repositorio no. Fases que allá eran `fixture` o `skipped` acá se miden de verdad |
| Paridad | La instalación puede gobernar algún archivo más. Verificá cuál |

### 14.4 Registrar la línea base

El resultado de esta corrida **es la línea base contra la cual se compara el ciclo siguiente**.
Anotala en el protocolo de verificación del repositorio con:

- el `git describe --tags` de lo instalado;
- piso, techo, banda ×6 y huella;
- payload base → optimizado, con la fidelidad por fase;
- paridad, suite, doctor y compuertas.

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
6. La banda ×6 contra la masa en disco.
7. Instrumentación: qué no existía en la versión vieja.
8. Herramientas obligatorias: instalador y cableado.
9. Payload, con la advertencia de comparabilidad.
10. Hallazgos, cada uno con `proof` reproducible.
11. **Alcance no cubierto**, con el mismo nivel de detalle que lo cubierto.

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
node --test "scripts/**/*.test.mjs"     # ✅ 807 tests en bash y en zsh
node --test scripts/**/*.test.mjs       # ❌ depende del shell
```

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

---

## Apéndice B — Adaptación por harness

### B.1 GitHub Copilot

- Superficies que lee: `.github/instructions/` (según `applyTo`), `.github/prompts/`,
  `.github/agents/`, `.github/skills/`, `.github/copilot-instructions.md`.
- El piso estándar del instrumento **es** su factura. Los números del protocolo aplican
  directamente.
- Ejecutá los comandos desde el terminal integrado. No hay orquestación paralela: corré las
  fases en orden, una por una.
- Para la Fase 8 (falso verde), `gate-exit-codes.test.mjs` ya hace el trabajo pesado; sólo
  agregá casos para las compuertas que no estén en su lista.

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

- Todo este protocolo corre con `bash` + `node`. No requiere ninguna herramienta propietaria.
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
- [ ] La suma de control de la descomposición cierra exactamente.
- [ ] Cada archivo del renglón [C] fue abierto y clasificado como contabilidad o conducta.
- [ ] El delta de la banda ×6 converge con el término [A].
- [ ] La masa de prosa en disco está medida y contrastada contra el piso.
- [ ] Las dos bandas de harness están reportadas por separado.
- [ ] Todas las compuertas corrieron en ambos árboles, con su exit code.
- [ ] Toda compuerta tiene al menos un caso que la vio fallar.
- [ ] Cada herramienta obligatoria tiene una línea de invocación identificada.
- [ ] Cada recorte tiene su prueba de equivalencia, o está etiquetado como capacidad perdida.
- [ ] El Invariant Gate falla cerrado y sus invocaciones llevan el flag que bloquea.
- [ ] La corrida real sobre la instalación está hecha y registrada como línea base.
- [ ] Cada hallazgo tiene un `proof` que otro puede ejecutar.
- [ ] El alcance no cubierto está listado con el mismo detalle que lo cubierto.
- [ ] Los arreglos van en una rama aparte, cada uno con su compuerta y su control negativo.
