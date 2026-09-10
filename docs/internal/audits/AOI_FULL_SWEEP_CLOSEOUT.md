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
