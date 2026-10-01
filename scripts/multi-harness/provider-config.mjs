/**
 * scripts/multi-harness/provider-config.mjs
 *
 * Descubre qué proveedores de modelos tiene configurados la máquina, leyendo la
 * configuración REAL de VS Code.
 *
 * Existe porque el repositorio enviaba un template (`ChatLanguageModel.example.json`)
 * con la configuración copiada de la máquina donde se generó, y las referencias de
 * secreto —`${input:chat.lm.secret.<hash>}`— sólo resuelven en esa máquina: el hash
 * lo genera VS Code al agregar el proveedor. Medido el 2026-09-28 contra el perfil
 * real: **4 de 6 coincidían con lo declarado**. Copiar el template produce una
 * configuración que parece correcta y falla al autenticar.
 *
 * Por eso este módulo **detecta y adopta; nunca fabrica**. No es prudencia: un script
 * no puede reproducir ese hash.
 *
 * Leer es seguro — el archivo contiene REFERENCIAS, no claves — pero igual se filtra a
 * `name`, `vendor`, `id`, `models[].name` y `models[].maxInputTokens`, y `apiKey` nunca
 * sale de acá.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Campos que se conservan de cada modelo. `apiKey` NO está, y no es un olvido. */
const SAFE_PROVIDER = ['name', 'vendor']
const SAFE_MODEL = ['id', 'name']
/**
 * Numéricos que se conservan sólo si el modelo los declara. `maxInputTokens` es la
 * ventana que lee `context-window.mjs`; medido el 2026-10-01, 7 de los 11 modelos
 * declarados la traen y 4 no (Kimi, MiniMax y GLM 5.3 vía Nvidia), así que un campo ausente no se rellena con nada.
 */
const SAFE_MODEL_NUMERIC = ['maxInputTokens']

/**
 * El directorio `User` de VS Code por plataforma.
 *
 * La variante de Windows se resuelve con `APPDATA` en vez de `os.homedir()`: en
 * Windows `homedir()` apunta a `C:\Users\<u>`, no a `AppData/Roaming`.
 */
export function vsCodeUserDir(home = os.homedir(), platform = process.platform, env = process.env) {
  if (platform === 'win32') {
    const appData = env.APPDATA ?? path.join(home, 'AppData', 'Roaming')
    return path.join(appData, 'Code', 'User')
  }
  if (platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'Code', 'User')
  return path.join(home, '.config', 'Code', 'User')
}

/**
 * Rutas candidatas, en orden de prioridad medida el 2026-09-28.
 *
 * Los cuatro archivos que se encontraron en la máquina auditada, con su tamaño:
 *
 *   | Ruta                                              | Bytes | Contenido            |
 *   | :------------------------------------------------ | ----: | :------------------- |
 *   | `User/chatLanguageModels.json`                     |     2 | `[]` vacío           |
 *   | `User/profiles/builtin/agents/chatLanguageModels.json` |  2 | vacío            |
 *   | `User/ChatLanguageModel.json` (singular)           |  1734 | un proveedor, parcial |
 *   | `User/profiles/<id>/chatLanguageModels.json`       |  4070 | AUTORITATIVO         |
 *
 * Las tres primeras son trampas: dos son stubs vacíos y la del singular es una copia
 * parcial. El autoritativo es el de perfil. Por eso se recorren **todos** los perfiles
 * antes que las rutas sueltas, y se elige el primero con proveedores.
 *
 * Se escanea el directorio de perfiles en vez de resolver `profileAssociations`, y
 * tiene un costo conocido: entre dos perfiles con proveedores gana el primero en orden
 * alfabético, no el asociado al workspace. `formatReport` lo advierte cuando pasa
 * (`sources > 1`). El daño está acotado porque nada se escribe desde acá: el Owner ve
 * la lista antes de elegir en el setup, y un modelo que no esté en el perfil real lo
 * rechaza el primer `runSubagent`, no una delegación a mitad de ciclo.
 */
export function configCandidates(home = os.homedir(), platform = process.platform, env = process.env) {
  const userDir = vsCodeUserDir(home, platform, env)
  const out = []

  const profilesDir = path.join(userDir, 'profiles')
  if (fs.existsSync(profilesDir)) {
    for (const id of fs.readdirSync(profilesDir).sort()) {
      out.push(path.join(profilesDir, id, 'chatLanguageModels.json'))
    }
  }

  out.push(path.join(userDir, 'ChatLanguageModel.json'))
  out.push(path.join(userDir, 'chatLanguageModels.json'))
  return out
}

/** Lee un archivo de config y devuelve sólo los campos seguros. `null` si no es legible. */
export function readProviders(file) {
  if (!fs.existsSync(file)) return null
  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null

  const out = []
  for (const raw of parsed) {
    if (!raw || typeof raw !== 'object') continue
    const provider = { models: [] }
    for (const k of SAFE_PROVIDER) provider[k] = raw[k]
    for (const m of Array.isArray(raw.models) ? raw.models : []) {
      if (!m || typeof m !== 'object') continue
      const model = {}
      for (const k of SAFE_MODEL) model[k] = m[k]
      for (const k of SAFE_MODEL_NUMERIC) if (Number.isFinite(m[k]) && m[k] > 0) model[k] = m[k]
      provider.models.push(model)
    }
    out.push(provider)
  }
  return out
}

/** Aplana a una entrada por modelo, conservando el proveedor. */
export function flatten(providers) {
  const out = []
  for (const p of providers ?? []) {
    for (const m of p.models ?? []) {
      const entry = { provider: p.name, vendor: p.vendor, id: m.id, name: m.name }
      if (m.maxInputTokens) entry.maxInputTokens = m.maxInputTokens
      out.push(entry)
    }
  }
  return out
}

/**
 * El primer candidato que declare al menos un modelo con nombre.
 *
 * `considered` incluye los descartados con su conteo, a propósito: un stub de 2 bytes
 * y un archivo ausente se leerían igual si sólo se devolviera el resultado, y esa
 * indistinción es la que hacía que el template pareciera una fuente válida.
 *
 * @returns {{ path: string|null, entries: object[], sources: number,
 *             considered: Array<{path: string, models: number, present: boolean}> }}
 */
export function discoverProviders(home = os.homedir(), platform = process.platform, env = process.env) {
  const considered = []
  let found = null

  for (const candidate of configCandidates(home, platform, env)) {
    const present = fs.existsSync(candidate)
    const providers = present ? readProviders(candidate) : null
    const entries = flatten(providers ?? [])
    considered.push({ path: candidate, models: entries.length, present })
    if (!found && entries.length > 0) found = { path: candidate, entries }
  }

  return {
    path: found?.path ?? null,
    entries: found?.entries ?? [],
    // Cuenta UBICACIONES con proveedores, no perfiles. Medido: en la máquina
    // auditada daba 2, y el segundo era `ChatLanguageModel.json` de la raíz — que
    // no es un perfil. Llamarlo `users` y decir "perfil/es" en el reporte describía
    // mal lo que el número cuenta.
    sources: considered.filter((c) => c.models > 0).length,
    considered,
  }
}

/** Los proveedores agrupados por nombre, con sus modelos. Para el reporte humano. */
export function groupByProvider(entries) {
  const out = new Map()
  for (const e of entries) {
    if (!out.has(e.provider)) out.set(e.provider, [])
    out.get(e.provider).push(e)
  }
  return out
}

/**
 * El identificador que `runSubagent` acepta, derivado del manifiesto.
 *
 * Vive acá y no en el auditor porque es conocimiento del MANIFIESTO —el sufijo se deriva
 * del campo `vendor`— y porque tenerlo en el auditor obligaba a un import circular entre
 * el auditor y el plan.
 *
 * El sufijo se DERIVA en vez de listarse: la tabla explícita del registro documentaba 3 de
 * los 4 proveedores en uso, y un proveedor nuevo quedaba sin cubrir.
 */
export function subagentValue(entry) {
  return entry.vendor === 'customendpoint' ? `${entry.name} (customendpoint)` : entry.name
}

/**
 * Reporte legible. **Nunca imprime una `apiKey`** — el lector ya la descartó, así que
 * acá no hay nada que filtrar, pero la garantía se declara donde se lee.
 *
 * Cuando no encuentra configuración nombra las ubicaciones revisadas: un "no hay
 * proveedores" sin la lista se lee igual que un bug de detección.
 */
export function formatReport(result) {
  if (result.entries.length === 0) {
    return [
      'No hay proveedores de modelos configurados en esta máquina.',
      '',
      `Se revisaron ${result.considered.length} ubicaciones:`,
      ...result.considered.map((c) => `  ${c.present ? 'existe, 0 modelos' : 'ausente          '}  ${c.path}`),
      '',
      'Agregá los proveedores desde VS Code:',
      '  Chat: Manage Models → Add Provider → Custom Endpoint',
      '',
      'VS Code crea la entrada Y el secreto en su llavero. Un script no puede hacerlo:',
      'el hash de `${input:chat.lm.secret.*}` lo genera VS Code y no es reproducible.',
    ].join('\n')
  }

  const lines = [
    `Proveedores detectados (${result.entries.length} modelos en ${result.sources} ubicación/es):`,
    `  ${result.path}`,
    '',
  ]
  for (const [provider, models] of groupByProvider(result.entries)) {
    lines.push(`  ${provider} — ${models.length} modelo(s)`)
    for (const m of models) lines.push(`      ${m.name}`)
  }
  if (result.sources > 1) {
    lines.push('')
    lines.push(
      `⚠️  ${result.sources} ubicaciones declaran proveedores y se usó la primera. ` +
        'Revisá si no esperabas esto: una copia vieja en la raíz puede tener menos modelos.',
    )
  }
  return lines.join('\n')
}

function main() {
  const result = discoverProviders()
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ path: result.path, entries: result.entries, sources: result.sources }))
    return
  }
  console.log(formatReport(result))
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
