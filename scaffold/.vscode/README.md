# Configuración de modelos en VS Code

AOI **no envía** configuración de proveedores. La detecta.

## Por qué

Hasta el 2026-09-28 este directorio contenía `ChatLanguageModel.example.json`, una
plantilla con los proveedores ya cargados, y `scripts/nvidia-vscode-setup.{sh,ps1}` —hoy
reemplazado por el detector `provider-vscode-setup.{sh,ps1}`— la copiaba al User dir de
VS Code.

Se retiró. La plantilla declaraba secretos como `${input:chat.lm.secret.<hash>}`, un
puntero al llavero de VS Code **cuyo hash lo genera VS Code** al agregar el proveedor.
Medido contra el perfil real: **4 de 6 no resolvían**. Copiar la plantilla producía una
configuración que parece correcta y falla al autenticar.

> **Un artefacto del repositorio no puede ser la fuente de verdad de un entorno que el
> repositorio no ve.** Un script no puede fabricar ese hash, así que la decisión correcta
> no es copiar mejor, sino no copiar.

## Cómo se configura

Desde VS Code:

```
Chat: Manage Models  →  Add Provider  →  Custom Endpoint
```

Eso crea la entrada **y** el secreto en el llavero. Después, para verificar:

```bash
node scripts/multi-harness/provider-config.mjs      # reporte legible
node scripts/multi-harness/provider-config.mjs --json
bash scripts/provider-vscode-setup.sh                 # lo mismo, desde el instalador
```

El detector **nunca imprime una `apiKey`**: filtra a `name`, `vendor`, `id` y
`models[].name`. Los archivos de configuración contienen *referencias*
(`input:chat.lm.secret.*`), no claves.

## Dónde vive la configuración

La detección recorre las ubicaciones en orden y usa la primera que declare modelos:

| Ubicación | Estado observado |
| :--- | :--- |
| `<User>/profiles/<id>/chatLanguageModels.json` | **la autoritativa** — la que VS Code usa con perfil |
| `<User>/ChatLanguageModel.json` | copia parcial; puede quedar vieja |
| `<User>/chatLanguageModels.json` | en esta máquina es `[]` |

Si el workspace usa el perfil por defecto (`__default__profile__`), la autoritativa es la
segunda. El detector escanea **todos** los perfiles antes de las rutas sueltas, toma el
primero con modelos en orden alfabético —no el asociado al workspace— y avisa si más de
una ubicación declara proveedores. Revisá esa lista antes de elegir en el setup.

**User dir por plataforma**:

| Plataforma | Path canónico |
| :--- | :--- |
| macOS | `~/Library/Application Support/Code/User/` |
| Linux | `~/.config/Code/User/` |
| Windows | `%APPDATA%\Code\User\` |

## Agentes por categoría

| Categoría | Agentes | Uso |
| :--- | ------: | :--- |
| Razonamiento | 18 | análisis, arquitectura, docs, orquestación |
| Implementación | 9 | código, terminal, git |

Los conteos se **derivan** del Agent Registry de `agent-delegation.instructions.md` y
`pnpm aoi:routing` los verifica: si un agente cambia de categoría y esta tabla no, la
cadena falla.

**No hay columna de proveedor, y es a propósito.** AOI sin instalar no trae ninguno. El
modelo de cada agente se elige en el **setup** (Phase 5.1) entre los que esta máquina
tenga configurados —uno para todos, uno por categoría, o uno por agente— y queda como
hechos O(1) en ICM bajo `{WORKSPACE}.assignment.*`. Sólo cambia con `/aoi-providers`.

```bash
node scripts/multi-harness/provider-setup.mjs --show            # qué tiene cada agente
node scripts/multi-harness/provider-store.mjs --resolve <agente> # lo que lee la delegación
```

Publicar acá qué proveedor usa cada agente sería fijar en el repositorio una decisión que
es de cada workspace — y ya cobró su precio: la versión anterior de esta tabla declaraba
una versión de modelo que la configuración real ya había superado.

## Seguridad

> 🔐 **NUNCA** commitees `ChatLanguageModel.json` con una API key real. Está en
> `.gitignore`.
>
> El archivo **con** claves nunca entra al repo. El que contenía las referencias y podía
> versionarse se retiró, así que ya no hay una plantilla que alguien pueda commitear por
> error creyendo que es inofensiva.
