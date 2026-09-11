# Cierre de la auditoría exhaustiva de AOI — 2026-09-10

Cierra [`AOI_FULL_SWEEP_2026-09-09.md`](AOI_FULL_SWEEP_2026-09-09.md), que se conserva
sin retocar. Aquel documento registra qué se encontró y por qué pudo vivir meses sin que
nada fallara; este registra qué se hizo, qué se midió y qué se decidió.

## Los ocho GAPs

| | Hallazgo | Cómo se cerró |
| :--- | :--- | :--- |
| **G0** | El instalador borraba `CLAUDE.md`, `AGENTS.md` y `.agents/` con `rm -rf` incondicional, fuera del merge | El prune sigue la regla del merge: borra solo lo byte-idéntico al scaffold, recorre los directorios archivo por archivo y reporta lo conservado. El harness elegido se persiste en `.conf/` y un reinstall que lo cambia lo avisa |
| **G1** | El Invariante 1 nombraba un proxy que no era dependencia, no se instalaba y no estaba registrado | `mcp-compressor` instalado por `uv`, ambos servidores MCP detrás del proxy, y `setup-mcp-gateway` verifica el `mcp.json` real en vez de la forma de un JSON |
| **G2** | `rtk/SKILL.md` (×6) afirmaba que un hook aplicaba RTK automáticamente | Los hooks se cablean de verdad y la skill dejó de prometer automatismo |
| **G3** | El rollback del Fiber duplicado byte a byte, y la copia que da nombre al invariante sin test | Una sola función exportada, probada de frente, con test estructural que falla si vuelven a separarse |
| **G4** | `CLAUDE.md` decía `-i high` donde el protocolo decía `critical`, ambas siempre en contexto | `compile-rules` deriva de `.github/instructions/` en vez de llevar copias hardcodeadas, con degradación al texto anterior si el archivo no se puede leer |
| **G5** | Cinco hooks declarados que ningún harness cargaba | Traducidos a `.claude/settings.json`, preservando lo que el Owner tenga ahí. Se verificó además que `.github/hooks/` **es** la convención de Copilot, corriendo `rtk init --copilot` en un directorio limpio: RTK escribe en esa misma ruta con esa misma forma |
| **G6** | Cero de las siete compuertas tenía test de su exit code | Cada caso arma una copia aislada, inyecta la violación exacta y corre el CLI real |
| **G7** | Mutation score 49% | 58% global, y el Invariante 3 de 35% a 76% |

Más un hueco que apareció por un error propio: **la paridad no podía ver un archivo que
no debería estar en el scaffold**. Copié `setup.sh` ahí sin mirar, dos veces, y ninguna
la detectó. `validateScaffoldContents` la cierra.

## Los seis hallazgos del ciclo en vivo

El ciclo completo con delegación real produjo seis, y **tres eran errores míos que no vi**.
El más grave lo encontró el subagente delegado, que solo tenía el payload TOON y ningún
historial — o sea que el aislamiento del Invariante 2 produjo un revisor independiente.

| | Hallazgo | Cómo se cerró |
| :--- | :--- | :--- |
| **L1** | El Invariant Gate aprobaba tags que viven en tests que ningún runner colecta | Descarta los archivos inalcanzables y lo dice en voz alta |
| **L2** | `rtk` imprime `PASS (0) FAIL (0)` y la compresión descarta el `No test files found` | Advertencia en `/sdd-verify`, donde se leen tests. El exit code sí es correcto: sale 1 |
| **L3** | Un test que existe y ningún runner colecta | `validate-test-globs` mira también la dirección inversa, leyendo globs de `node --test` y el `include` de vitest |
| **L4** | La Compuerta de Service Discovery consultaba un catálogo vacío mientras había 12+ servicios en disco | El prompt nombra el escaneo concreto: por el nombre exportado que se va a crear |
| **L5** | El payload de subagente decía `ws=workspace`, el default | Se deriva del task dir |
| **L6** | El registry declaraba cero tareas con dos en disco | `aoi:registry` compara ambos lados y calcula el próximo id sobre el máximo |

## Las tres decisiones del Owner

**No mergear hasta terminar todo y comprobar comportamiento, funcionamiento y ahorro.**
La rama sigue sin mergear.

**Implementar lo que no estaba implementado.** El Guarded Unload era un comentario dentro
de un `if` vacío: un proveedor se desmontaba con un consumidor vivo y los inversos del
consumidor corrían después contra un contexto cuya dependencia ya se había ido. Ahora el
teardown es por orden de dependencia, en profundidad, con guarda de ciclos.

Escribiendo ese test apareció algo peor. Una fiber sin dependencias se activa
**fire-and-forget**, así que un teardown en el mismo tick llamaba a `recover()` antes de
que `apply()` hubiera registrado su inverso: **el inverso no se ejecutaba** y el efecto
sobrevivía al rollback sin que nada reportara problema. El teardown ahora espera la
activación que se propone revertir.

**Validaciones conductuales reales antes de decidir, sin omitir pruebas.** El nivel del
compresor MCP se eligió midiendo:

| | superficie | parámetros | costo real |
| :--- | ---: | :--- | :--- |
| `high` | 638 tok | visibles | invocación directa |
| `max` | 500 tok | **ocultos** | + 287 tok por `get_tool_schema` |

`max` ahorra 138 y cuesta 287 desde la primera herramienta usada. Queda `high`.

## Lo que se midió

**Ahorro por ciclo, piso de contexto:**

| | tokens |
| :--- | ---: |
| Piso al abrir la auditoría | 91.940 |
| A4 · derivar la copia de antigravity desde la instruction | −1.716 |
| A3 · boilerplate idéntico fuera de los 27 agentes | −296 |
| **Piso al cerrar** | **89.928** |

**Ahorro por sesión, superficie MCP** — medido mandando el handshake a mano, `tools/list`
crudo contra proxeado:

| servidor | herramientas | crudo | comprimido |
| :--- | ---: | ---: | ---: |
| icm | 31 | 3.538 | 638 |
| codebase-memory-mcp | 14 | 2.888 | 460 |
| **total** | **45** | **6.426** | **1.098** (−83%) |

Se paga en el system prompt de cada request que lleva la superficie MCP, así que se
ahorra toda la sesión; no es una cifra por ciclo.

**Mecanismos que el benchmark acreditaba y el ciclo real no conseguía**, ahora cableados:
`context-tombstone` (1.085/ciclo) en `/sdd-apply` y `diagnostic-distiller` (190/ciclo) en
`/sdd-verify`.

## Instrumentos que AOI no tenía

- **Testing de mutación.** Muta el código en una copia aislada y corre la suite; un
  mutante que sobrevive es una línea que ningún test restringe.
- **`aoi:tools`** — cada herramienta de ahorro obligatoria (todas salvo Headroom) debe
  estar exigida por el instalador y ser invocada en el ciclo **real**, nunca en el
  benchmark, que mide pero no ejecuta el producto. Distingue lo que comprime la
  comunicación entre componentes de lo que optimiza una fase.
- **`aoi:hooks`** — una declaración cableada a medias se reporta huérfana, y un script
  que no existe o no es ejecutable se reporta roto.
- **`aoi:registry`** — el registry contra el disco, con el próximo id sobre el máximo de
  ambos.
- **`aoi:cache-prefix`** — la masa repetida del piso y su multiplicador.

## El patrón que se repitió, y que es el hallazgo de fondo

Casi todos los defectos tienen la misma forma: **algo que existe, tiene tests verdes, y
no participa del flujo real**. El proxy que no era dependencia. El mecanismo que solo el
benchmark invocaba. El tag en un test que nadie colecta. El guard cuyo resultado caía en
un `if` vacío. La compuerta que certifica un componente inexistente.

De ahí que la pregunta correcta nunca sea *"¿existe?"* sino **"¿quién lo invoca en el
ciclo real?"**.

Y el corolario incómodo: **cuatro de los defectos más graves estaban en código que yo
mismo había escrito y auditado en la misma pasada.** El guardián hereda el punto ciego de
quien escribe el cambio. Lo que los encontró fue el testing de mutación, la auditoría
adversaria con refutación, y un subagente aislado sin historial — tres formas distintas
de mirar desde afuera.

## Lo que queda declarado y sin cerrar

- **74 mutantes sobreviven**: 23 son plomería de CLI y 51 lógica, casi toda guardas de
  validación de entrada que ningún test golpea con entrada inválida. Reales, baja
  severidad.
- **Un mutante equivalente documentado**: `!providerFiber.provides` es inalcanzable
  porque `instantiate` normaliza a `[]`. Perseguirlo sería contorsionar un test contra
  código defensivo muerto.
- **La línea base del benchmark** se regenera en cada corrida del protocolo; la de este
  cierre está en `AOI_REAL_WORLD_VERIFICATION_MATRIX.md`.

---

# Segunda pasada — 2026-09-10

La primera pasada cerró G0–G7 y L1–L6 y dejó una lista de 32 hallazgos
adversarios sin verificar. Esta pasada los recorrió todos. Diez eran majors,
diez quedaron cerrados, y el recorrido destapó cinco defectos más que la lista
no tenía.

## El patrón que recorre casi todo lo encontrado

Todos los hallazgos de esta pasada caen en dos formas, y las dos son la misma
enfermedad vista desde lados distintos.

**La primera es el veredicto afirmativo sobre cero entradas.**
`validate-agent-routing` imprimía «Every agent resolves to a model» con el
registro vacío. `reference-integrity` imprimía «Every reference resolves» con
cero archivos escaneados. `validate-srp` imprimía «no new SRP violations»
mientras 901 líneas de fuente gobernada vivían detrás de un símlink que su
recorrido no seguía. `token-tool-coverage` contaba una frase que decía «sacamos
context-tombstone» como prueba de que el ciclo lo invocaba. Ninguna de las
cuatro estaba rota en el sentido de producir un error: todas producían un
checkmark, que es peor, porque un error se investiga y un checkmark se cree.

**La segunda es el segundo escritor.** El merge de tres vías del instalador es
una resta: lo que hay en disco, menos lo que AOI registró haber instalado, es
la edición del Owner. Cualquier otro proceso que escriba un archivo gobernado
rompe esa resta, y rompe de dos maneras opuestas según cuándo corra. Antes de
la comparación, reemplaza los bytes del Owner por los de AOI y el comparador
lee su propia salida y culpa al Owner —así terminó el guard en
`.conf/conflicts/` en un workspace donde nadie lo había abierto. Después de la
comparación, simplemente pisa lo que el merge decidió —así se reemplazaba el
`pnpm-workspace.yaml` de un monorepo existente, con todos sus paquetes adentro.

Las dos formas comparten una raíz: **una afirmación que nadie puede
contradecir**. La compuerta afirma sobre un conjunto vacío; el segundo escritor
afirma sobre un archivo que otro ya decidió. En ambos casos el sistema queda
sin nadie que pueda decir que no.

## El caso que más enseña

`.vscode/settings.json` fue clasificado mal en las dos direcciones posibles, y
verlo fallar de los dos lados es lo que reveló que el modelo estaba mal de
raíz.

Los checksums se calculaban del scaffold, pero el instalador materializa ese
archivo sustituyendo un placeholder por `$HOME`. El comparador leía la
sustitución del propio instalador como edición del Owner y declaraba CONFLICTO
—de forma permanente, porque el desajuste se reproduce en cada corrida. Re-basear
los checksums desde el disco arregló eso… y produjo una regresión peor: el
archivo pasó a clasificarse `auto_update`, y `auto_update` copia el archivo
ENTERO. La siguiente reinstalación borró en silencio las claves de spec-kit
`chat.promptFilesRecommendations` y `chat.tools.terminal.autoApprove`.

La lección no es que el segundo arreglo estuviera mal. Es que **la pregunta
«¿conflicto o actualización?» no tenía respuesta correcta**, porque el archivo
no es de AOI ni del Owner: es un objeto JSON compartido donde AOI posee unas
claves y spec-kit y el Owner poseen el resto. Ninguna decisión a granularidad
de archivo puede ser correcta sobre eso. La solución fue sacarlo del merge por
archivo y fusionarlo por clave. Lo mismo aplicó a `.vscode/mcp.json`, que se
regeneraba entero y hacía desaparecer cualquier servidor MCP que el Owner
hubiera registrado.

## El override que no podía funcionar

El guard que impide que `headroom learn --apply` reescriba la superficie de
instrucciones gobernada por AOI estaba cableado como hook `pre-commit` — el
único hook que no puede hacer ese trabajo. Git escribe el mensaje del commit
recién después de que `pre-commit` termina bien, así que el marcador
`[aoi-managed-ok]` que el propio texto de error le indicaba al Owner nunca
podía aplicar al commit para el que se escribía. Comprobado con git de verdad:
en `pre-commit` el archivo contiene el subject del commit ANTERIOR, y está
vacío en el primero.

Y el fallback era peor que inútil. Ante un `COMMIT_EDITMSG` sin marcador, el
guard consultaba `git log -1`, o sea el subject ya commiteado: un marcador
dejado ayer autorizaba el diff de hoy, sin que nadie lo hubiera revisado. Un
override es una afirmación sobre un diff concreto; arrastrarlo hacia adelante
lo convierte en su opuesto.

## Lo que la cobertura por mutación agregó

`pnpm test` responde si el código sigue haciendo lo que los tests dicen. La
sonda de mutación responde la pregunta de abajo: **si los tests siguen diciendo
algo**. Sobre cuatro áreas dio 62%, 57%, 46% y 49%, y los sobrevivientes
tienen una forma común en todas: **la librería está probada y su `main()` no**,
y la CLI es lo que el ciclo SDD invoca de verdad.

El más caro fue una sola línea del verificador determinista:

```js
if (enforceExitCode && unified.status !== 'PASSED') process.exit(1)
```

Invirtiendo `!==` a `===`, la compuerta sale 1 sobre una verificación limpia y
0 sobre una fallida, y la suite entera quedaba en verde. `/sdd-verify` lee ese
exit code para decidir si una tarea puede cerrarse.

La sonda también encontró un defecto escribiendo su propio test: `shrinkTurns`
detectaba un no-array y después hacía `[...turns]` sobre él, o sea que
`shrinkTurns(null)` tiraba «turns is not iterable» — una defensa que revienta
con exactamente la entrada para la que se escribió.

Y la sonda tenía el mismo tipo de defecto que buscaba: mutaba dentro de
literales de cadena, de modo que un separador `'============'` generaba
mutantes que cambiaban un banner, sobrevivían a todo, e inflaban el conteo con
hallazgos que no eran sobre la lógica. Un instrumento de medición que se mide a
sí mismo mal reporta sobre sí mismo, no sobre el código.

## Qué queda declarado y sin cerrar

- **249 mutantes sobreviven** entre las cuatro áreas, casi todos en superficies
  de CLI que ningún test ejecuta. El piso quedó registrado en
  `MUTATION_FLOOR` y sólo puede subir; `pnpm aoi:mutation` lo verifica.
- **11 de 29 fuentes del dashboard** no las carga ningún test. Diez son glue de
  Nitro o de ciclo de vida Vue de entre 8 y 24 líneas sobre utilidades que sí
  están cubiertas; cada exención está declarada con su motivo en
  `UNREACHED_BUDGET` y la lista sólo puede achicarse.
- **El piso de tokens no se movió**: 90.059, idéntico al ciclo anterior. Esta
  rama compró corrección, no reducción, y que el piso no se haya movido es la
  comprobación de que no coló prosa en ninguna superficie inyectada.
