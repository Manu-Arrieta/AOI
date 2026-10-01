# Resolución de proveedores en el arranque, congelada por ciclo

**Fecha**: 2026-09-28
**Estado**: **IMPLEMENTADO con la corrección del Owner de §A** — la elección se movió de
`/init` al **setup**, con tres niveles (todos, categoría, agente), y sólo cambia con
`/aoi-providers`. Las §5 y §10 describen el diseño intermedio y quedan como historia.
**Origen**: `docs/internal/audits/AOI_AUDIT_2026-09-28_v2.5.2-160-g12fc8db.md`
**Reemplaza**: la versión previa de este mismo archivo (2026-09-28), que asumía una
asignación estática en el repositorio.

---

## A. Corrección del Owner (2026-09-28): se elige en el setup, no en `/init`

La auditoría `AOI_AUDIT_2026-09-28_provider-assignment_v2.5.2-160-g12fc8db-dirty.md`
encontró que el diseño intermedio de este documento escribía la asignación y **nadie la
leía**: el registro seguía mandando a una columna de modelo que ya no existía, y la
premisa que lo compensaba —*"`icm wake-up` carga los facts"*— era falsa, medido. El Owner
fijó entonces el requisito:

1. AOI sin instalar no trae **ningún** proveedor asociado.
2. En el **setup** se elige uno para todos, uno por categoría o uno por agente.
3. Sólo cambia cuando el Owner lo pide o invoca **`/aoi-providers`**.

| Pieza | Qué hace |
| :--- | :--- |
| `scripts/multi-harness/provider-store.mjs` | claves, resolución `agente → categoría → todos`, y `--resolve <agente>`: **el lado que lee** |
| `scripts/multi-harness/provider-setup.mjs` | **única vía de escritura**: `--interactive --if-empty` (setup) y `--set`/`--unset`/`--reset`/`--show` (`/aoi-providers`) |
| `setup.sh`, Phase 5.1 | diálogo interactivo; sin terminal no elige nada; reinstalar no pisa lo existente |
| `.github/prompts/aoi-providers.prompt.md` | el comando: mostrar, preguntar, sondear **por modelo**, escribir, verificar |
| `pnpm aoi:providers` | falla con `ASIGNACIÓN MUERTA` si un valor guardado no está configurado en la máquina |
| `agent-delegation`, Step 1 | el modelo sale de `--resolve`; exit 3 = sin asignar = no delegar |

Claves en ICM, entidad = nombre del directorio del workspace (la que escribe `setup.sh`):

```
assignment.default                  uno para todos
assignment.category.<slug>          razonamiento | implementacion   (sin tilde, a propósito)
assignment.agent.<agente>           override de un agente
assignment.resolvedAt               ISO 8601 de la última escritura
```

Lo que **se descartó** de este documento: el plan de `/init` (`provider-plan.mjs`,
eliminado), los facts `providers.*.status`/`detail`/`checkedAt` (el setup no puede sondear:
`runSubagent` es de la sesión; el sondeo es un paso de `/aoi-providers`, por modelo), y el
override de `/sdd-genesis`, que corre en la sesión del operador y por lo tanto usa el
modelo del picker — ningún fact puede alcanzarlo.

**Diferido**: `setup.ps1` no tiene la Phase 5.1. No hay `pwsh` en la máquina de
desarrollo para verificarlo; en Windows la asignación se hace con `/aoi-providers`.

## 0. Qué cambió desde la versión anterior

La versión previa asumía que la asignación `agente → modelo` era una **definición
estática** que debía vivir en el repositorio, y que sólo el *liveness* del proveedor
pertenecía a ICM. **Era una lectura incompleta**, y la corrección vino de verificar dónde
vive realmente la configuración.

El requisito correcto: **no depender de proveedores fijos**, definirlos en `/init`, y que
cada ciclo use esa configuración **hasta que se decida cambiarla manualmente**. La
evidencia de §1 muestra que eso no es una preferencia estética: la configuración
autoritativa **no está en el repositorio**, vive en una ruta que depende del perfil de VS
Code, y **ya divergió** del template que el repo hardcodea.

### La distinción que faltaba

| | Naturaleza | Dónde vive | Cambia |
| :--- | :--- | :--- | :--- |
| **Qué categoría de modelo necesita un agente** | definición | repo, versionado | cuando alguien decide |
| **Qué proveedores existen y responden** | entorno | config de VS Code, fuera del repo | con las cuentas del Owner |
| **Qué proveedor concreto sirve a cada categoría** | **decisión del Owner** | se elige en `/init` | manualmente |

La tercera fila es la que faltaba, y es la que el Owner nombró.

---

## 1. Evidencia: la configuración autoritativa está fuera del repo y ya divergió

Se auditaron las cuatro ubicaciones de configuración de modelos en la máquina:

| Archivo | Tamaño | Contenido |
| :--- | ---: | :--- |
| `User/chatLanguageModels.json` | **2 bytes** | `[]` — stub vacío |
| `User/profiles/builtin/agents/chatLanguageModels.json` | **2 bytes** | vacío |
| `User/ChatLanguageModel.json` | 1.734 | **sólo NVIDIA**, GLM **5.2** |
| **`User/profiles/-5f85a270/chatLanguageModels.json`** | **4.070** | ✅ **el autoritativo** |

El del perfil activo contiene 6 providers / 12 modelos y **coincide exactamente** con la
lista autoritativa que el picker devuelve al invocar `runSubagent`.

### Las dos divergencias medidas

1. **El template del repo declara GLM 5.2; el perfil tiene GLM 5.3.** El manifiesto
   instalado está una versión atrás de lo que el proveedor realmente ofrece.
2. **Dos modelos existen y el template no los declara**: `Deepseek v4 flash` y
   `Kimi-k 3`.

Tres de los cuatro archivos son trampas: uno vacío, uno parcial, y el que el instalador
del repo escribe por defecto. La resolución de ruta correcta **ya existe** en el
repositorio: `scripts/nvidia-vscode-setup.sh` lee `profileAssociations.workspaces` del
storage de VS Code. Es shell más `python3`, y se porta a Node.

**Conclusión**: hardcodear el manifiesto en `scaffold/` es estructuralmente incorrecto,
porque el repositorio no puede saber qué cuentas ni qué perfiles tiene cada máquina.

---

## 2. El límite que no cambia

Un script en `scripts/` corre en Node y **no tiene acceso a `runSubagent`**. La única forma
de saber si un proveedor responde es **preguntarle a un modelo**.

> La observación **es** una invocación de modelo.

Eso no puede vivir en `pnpm test`. Pero con la decisión de **congelar**, la limitación deja
de pesar tanto: se sondea **una vez en `/init`**, no en cada ciclo.

---

## 3. Las tres capas

| Capa | Qué contiene | Dónde vive | Frecuencia |
| :--- | :--- | :--- | :--- |
| **A. Declarativa** | `agente → categoría` | repo, versionado, espejado | cambia con un commit |
| **B. Resuelta** | `categoría → proveedor vivo` | facts de ICM, por workspace | **se elige en `/init`** |
| **C. Consumo** | los ciclos leen los facts | — | congelado hasta cambio manual |

---

## 4. Capa A — Registro reducido a `agente → categoría`

El registro pierde las columnas `Model` y `Fallback`. La columna `Category` **ya existe** y
es la semilla: 18 agentes en Razonamiento, 9 en Implementación.

| | Actual | Propuesta |
| :--- | ---: | ---: |
| Filas | 27 | 27 |
| Columnas | 4 | **2** |
| Tabla / fase | **696** tok | **317** tok |
| Ahorro / ciclo (×7) | — | **2.653** tok |
| `agent-delegation` completo | 1.860 tok | **~1.540** tok |

### Las excepciones se conservan

Medido: **Razonamiento abarca 3 proveedores** (15 agentes en uno, 2 en otro, 1 en un tercero) mientras
**Implementación era uno solo**. El Owner confirmó que **esa granularidad fue intencional**,
y que ahora **se elige en el arranque**.

Por eso el registro no colapsa a una sola fila por categoría: los 24 agentes que siguen el
default toman la categoría, y las **3 excepciones** (`solution-architect`,
`triage-specialist`, `ux-designer`) llevan una anotación explícita. Son 3 filas, no 27.

### El obstáculo del presupuesto desaparece

En la versión anterior, agregar una fila al registro costaba tokens contra `BAND_BUDGET`
(que sólo permite encoger). Con las columnas de proveedor fuera de la tabla, **agregar un
proveedor deja de costar tokens de banda**: el proveedor ya no está escrito ahí.

Queda un ajuste mecánico: bajar `agent-delegation` de 1.860 y bajar `BAND_CEILING` en el
mismo cambio, porque el techo tiene que ser la suma exacta.

---

## 5. Capa B — Resolución en `/init`

`/init` **no está en `BAND_BUDGET`**, así que el protocolo que sigue no cuesta tokens de
banda.

### Paso 1 — Descubrir

Resolver la ruta autoritativa con la lógica de perfil que ya existe, con el orden medido de
§1. Leer **sólo** `name`, `vendor`, `id` y `models[].name`. **Nunca imprimir un `apiKey`.**

### Paso 2 — Sondear

Una invocación trivial por proveedor, **secuencial**. En paralelo no se distingue un rate
limit por concurrencia de una cuenta sin saldo — medido: los primeros cuatro sondeos se
lanzaron en paralelo y el reintento secuencial devolvió el mismo `1113`, que es lo que
convierte "falló una vez" en "está caído".

El detalle que hace que esto funcione: **la sonda NO debe pasar `agentName`**. Los 27
`.agent.md` tienen `## Session Start — MANDATORY`, y medido: se les pidió *no* ejecutar su
protocolo y **2 de 4 lo hicieron igual**. Sin `agentName` se sondea el modelo, que es lo
único que se quiere saber.

Taxonomía de errores, medida el 2026-09-28:

| Respuesta | Clase | Origen |
| :--- | :--- | :--- |
| responde | `ok` | — |
| `Requested model not found` | `absent` | **defecto nuestro**: el nombre derivado no existe |
| `Insufficient balance` | `unfunded` | **del proveedor** |
| `Access to model denied` | `ineligible` | **del proveedor** |
| timeout / red | `error` | transitorio |

La distinción importa: `absent` es un defecto **nuestro** y lo atrapa la compuerta estática;
`unfunded` e `ineligible` son del **proveedor** y ninguna compuerta puede verlos.
Confundirlos manda el arreglo al lugar equivocado.

### Paso 3 — Decidir

Con el estado de cada proveedor a la vista, **el Owner elige**:

- proveedor por **categoría** (Razonamiento, Implementación)
- proveedor por **excepción** (`solution-architect`, `triage-specialist`, `ux-designer`)

Si una categoría no tiene ningún proveedor vivo, **se ve en este paso**, no a mitad de un
ciclo. Es una decisión en el arranque, no una falla en runtime.

**Un proveedor que no esté en estado `ok` se rechaza.** Decisión del Owner: no se permite
elegir un proveedor `unfunded` ni `ineligible`, ni siquiera con advertencia. Elegir uno
caído mueve el problema al medio del ciclo, que es exactamente lo que el pre-flight existe
para evitar. La opción es reponerlo y volver a correr la resolución, o elegir otro.

### Paso 4 — Persistir

Los facts, con alcance por workspace:

```
{WORKSPACE}.providers.{provider}.status     ok | absent | unfunded | ineligible | error
{WORKSPACE}.providers.{provider}.detail     la línea de error, una sola
{WORKSPACE}.providers.checkedAt             ISO 8601, UNO por corrida
{WORKSPACE}.assignment.{categoria}          el modelo elegido para esa categoría
{WORKSPACE}.assignment.agent.{agente}       la excepción, si la hay
```

El conjunto de agentes bloqueados **se deriva, no se persiste**: un fact redundante es un
fact que puede contradecir a otro.

---

## 6. Capa C — Congelado hasta cambio manual

Decisión del Owner: **todo congelado hasta cambio manual**. Ningún ciclo re-sondea.

Esto tiene una consecuencia que hay que tratar explícitamente:

> `icm wake-up` carga los facts **sin verificación**. El propio texto de `/init` lo advierte:
> *"se lee como verdad asentada por toda sesión futura"*.

Un `Proveedor A: ok` de hace una semana se lee con la misma autoridad que uno recién medido, y el
ciclo no lo va a re-chequear, por decisión de diseño.

**No hay umbral de antigüedad ni advertencia por datos viejos.** Decisión del Owner: el
dato está viejo *por diseño*, porque el cambio de modelo es manual. Avisar que el dato tiene
N días sería avisar de algo que el Owner ya decidió. `checkedAt` se persiste igual, pero
como **metadata de auditoría** — para poder responder "¿cuándo se verificó esto?" — y no
como disparador de nada.

Cambiar la asignación es una acción explícita: re-correr el paso de resolución de `/init`,
o editar los facts. Nada más la mueve.

---

## 7. Configuración de proveedores: eliminar el template y detectar en el setup

### El template está roto por construcción

Medido (auditoría C7): `scaffold/.vscode/ChatLanguageModel.example.json` referencia
secretos con hashes que **no resuelven** en el perfil real.

| Proveedor | Template | Config real | |
| :--- | :--- | :--- | :--- |
| NVIDIA | `46ff130f` | `-1d681851` | ❌ |
| DeepSeek | `-5bf18d36` | `7500c84` | ❌ |
| Proveedor B | `-66432d39` | `3d2a222a` | ❌ |
| Kimi | `-60795c8c` | `4961be6c` | ❌ |
| MiniMax | `2bd15d4f` | `2bd15d4f` | ✅ |
| Proveedor A | `-4dc2323c` | `-4dc2323c` | ✅ |

**4 de 6 difieren.** `input:chat.lm.secret.<hash>` es un puntero al almacén de secretos de
VS Code, y **lo genera VS Code** cuando el Owner agrega el proveedor. **Un script no puede
fabricarlo.**

Y el flujo es `cp "$TEMPLATE_FILE" "$DEST_FILE"`: copiar el template **destruye la
configuración que funciona** y la reemplaza por una que falla en 4 de 6 proveedores.

El reemplazo de la API key tampoco funciona: el script busca
`APIKEY-CONFIGURADA-PREVIAMENTE` y ese literal **no existe en el template**. Pasar `--key`
no reemplaza nada, e imprime "API key reemplazada".

### Decisión: eliminar y detectar

Se elimina `scaffold/.vscode/ChatLanguageModel.example.json` y el flujo de copia.

| Antes | Después |
| :--- | :--- |
| `cp` de un template del repo | **Detectar** la configuración existente |
| Sobrescribe tras `[y/N]` | **Nunca escribe** |
| Referencias de secreto de otra máquina | Referencias reales, ya generadas por VS Code |
| Declara GLM 5.2 | Lee lo que hay (GLM 5.3) |

**El setup detecta y adopta; no fabrica.** La razón no es prudencia: es que el hash del
secreto lo genera VS Code y ningún script puede reproducirlo.

**Si la configuración no existe**, el Owner agrega los proveedores desde la UI de VS Code —
que crea la entrada **y** el secreto en el llavero. El setup imprime las instrucciones y no
inventa una entrada.

Leer la configuración es seguro: contiene **referencias** `input:chat.lm.secret.*`, no
claves. Aun así, el lector filtra a `name`, `vendor`, `id` y `models[].name`, y **nunca
imprime `apiKey`**.

### Separación de responsabilidades

| Qué | Quién | Cuándo |
| :--- | :--- | :--- |
| Qué proveedores **existen** en la máquina | VS Code (UI) + detección del setup | instalación |
| Qué proveedor sirve a **cada categoría** | `/init` | bootstrap del workspace |
| Cuándo **cambia** la asignación | el Owner, manualmente | cuando decida |

`/init` **no puede elegir un proveedor que no exista**, así que el setup corre primero. Pero
`/init` también corre en el repositorio de desarrollo de AOI, donde `setup.sh` no se
ejecuta: tiene que tolerar "proveedores todavía no configurados" sin romper.

### El radio de impacto de la eliminación

No es borrar un archivo. **7 archivos** lo referencian:

| Archivo | Qué hay que hacer |
| :--- | :--- |
| `scripts/nvidia-vscode-setup.sh` / `.ps1` | De copiador a detector |
| `setup.sh` Fase 1.5 | Generalizar: no es "NVIDIA", es "proveedores". El mensaje nombra modelos vencidos (Kimi K2.6, DeepSeek V4 Pro, MiniMax M3, Qwen 3.5) y **omite GLM**, que usan 9 agentes |
| `.github/instructions/model-selection.instructions.md` §4 | Deja de apuntar al template |
| `scripts/multi-harness/agent-model-blocks.test.mjs` | **Pinnea el literal** `ChatLanguageModel.example.json`: borrar el template sin tocar el test deja la cadena roja |
| `scaffold/.vscode/README.md` | Documenta el template |
| `.gitignore` | La negación `!.vscode/ChatLanguageModel.example.json*` queda huérfana |
| `scripts/multi-harness/provider-assignment.mjs` | Hoy lee el template como manifiesto; pasa a leer la configuración detectada |

`.vscode/` **no** es ruta gobernada por paridad, así que borrar el archivo no rompe el
espejo — pero sí rompe el test que lo nombra.

---

## 8. Qué sobrevive de lo ya construido

`scripts/multi-harness/provider-assignment.mjs` **no se descarta**: cambia su fuente y su
pregunta.

| Sobrevive | Cambia |
| :--- | :--- |
| La estructura del gate y su lugar en la cadena | De dónde lee: del template del repo a los facts resueltos |
| `parseRegistry` de `validate-agent-routing` | La forma del registro que parsea |
| `subagentValue`: derivar el sufijo desde `vendor` | — |
| El fix de deduplicación y su test falsificado | — |
| El patrón de rutas candidatas (`scaffold/` en dev, raíz instalado) | Se suma la ruta de perfil |
| Los dos documentos | — |

Aproximadamente el **60%** se reutiliza. La pregunta que responde el gate cambia: de *"¿el
valor del registro resuelve en el template?"* a *"¿cada categoría resuelve a un proveedor
con estado `ok`?"*.

---

## 9. Lo que este diseño NO cubre

- **No verifica que el proveedor responda bien**, sólo que responda.
- **No detecta la muerte de un proveedor entre dos resoluciones** — es la consecuencia
  directa de congelar, y es una decisión consciente del Owner.
- **No arregla nada.** Reponer saldo y habilitar cuentas son acciones del Owner.
- **No corre en CI** la parte de sondeo: sin sesión de asistente no hay `runSubagent`.
- **No elimina la dependencia de VS Code.** Elimina el template, pero la configuración sigue
  viviendo en un archivo de VS Code y la detección depende de su formato. Es una dependencia
  más chica y honesta, no su ausencia.
- **No puede crear proveedores.** Si la máquina no tiene ninguno configurado, el setup
  detecta cero y el Owner tiene que agregarlos desde la UI de VS Code.

---

## 10. Plan de implementación

| # | Artefacto | Naturaleza | Costo de banda |
| :--- | :--- | :--- | :--- |
| 1 | **Eliminar** el template y convertir el setup en detector | código + borrado | 0 |
| 2 | Actualizar los 6 archivos del radio de impacto, incluido el test que pinnea el literal | prosa + código | 0 |
| 3 | Registro reducido a `agente → categoría` + 3 excepciones | prosa + ajuste de presupuesto | **−319 tok** |
| 4 | Resolución de ruta de perfil portada a Node | código + tests | 0 |
| 5 | Protocolo de resolución en `/init` (4 pasos) | prosa | **0** (no está en la banda) |
| 6 | Gate que valida cada categoría contra los facts resueltos | código + tests | 0 |
| 7 | Registro del contrato de facts en el protocolo de ICM | prosa | ⚠️ toca `icm-protocol` (en la banda) |

El paso 7 es el único que consume banda, y el paso 3 **libera 319 tokens**: el cambio neto
es un **ahorro**. Eso convierte el obstáculo de la versión anterior en un beneficio.

**Es una tarea SDD con contrato**, no un fix directo: cambia la forma de un archivo
gobernado, borra un artefacto instalado y agrega un protocolo al arranque.

### Orden recomendado

Los pasos **1 y 2 primero**, y por una razón de riesgo: mientras el template exista, el flujo
de `nvidia-vscode-setup.sh` puede **sobrescribir la configuración real** de un Owner que
acepte la confirmación `[y/N]`. Es un footgun activo, no una deuda pasiva.

---

## 11. Decisiones tomadas y pendientes

### Tomadas

| Pregunta | Decisión |
| :--- | :--- |
| ¿Re-sondear por ciclo? | **No.** Todo congelado hasta cambio manual; el cambio de modelo se pide a mano |
| ¿Umbral de antigüedad de `checkedAt`? | **No hay.** El dato está viejo por diseño; `checkedAt` queda como metadata de auditoría |
| ¿Dónde se elige la asignación? | En `/init` |
| ¿Y la configuración de proveedores? | En el **setup**, por detección. El template hardcodeado se **elimina** |
| ¿Se permite elegir un proveedor caído? | **Se rechaza** |

### Pendientes

1. ~~Si la máquina no tiene proveedores configurados~~ — **resuelto**: el setup avisa,
   deja los agentes sin asignar y sigue; la delegación se detiene con exit 3.
2. ~~Qué pasa con los facts cuando el Owner cambia un proveedor~~ — **resuelto**: sólo
   `/aoi-providers` escribe; `--reset` borra los overrides viejos antes de escribir.
3. **Si `input:chat.lm.secret.*` cambia de formato** en una versión futura de VS Code.
   Sigue abierto: es un detalle de un tercero.
4. **`setup.ps1`, Phase 5.1** — diferido hasta poder verificarlo en Windows.
