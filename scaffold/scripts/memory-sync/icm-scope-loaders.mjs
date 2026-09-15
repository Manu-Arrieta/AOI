/**
 * scripts/memory-sync/icm-scope-loaders.mjs
 *
 * Lee el store de ICM y devuelve, por scope, el payload que el bundle va a
 * llevar. Nada más: no sabe de manifiestos, de rutas de artefacto ni de gzip.
 *
 * Separado de `export-memory-bundle.mjs` por el mismo motivo que el resto de los
 * cortes de este subsistema: "cómo se lee el store" y "cómo se arma y se emite
 * un bundle" son preguntas distintas, y crecen por motivos distintos — la
 * primera cada vez que ICM cambia su salida de texto, la segunda cuando cambia
 * el formato del bundle. El archivo que las unía estaba en las 300 LOC exactas
 * del Invariante 5: cero headroom, y la próxima línea de cualquier persona
 * rompía la build.
 *
 * `isWorkspaceScopedTopic` es la única pieza que se prueba sola, así que
 * `export-memory-bundle.mjs` la re-exporta y su superficie pública no cambió.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const defaultMemoirNames = ['architecture', 'domain-model', 'api-contracts']

function splitCliBlocks(raw) {
  const normalized = raw.trim()

  if (!normalized) {
    return []
  }

  return normalized
    .split(/\n(?=--- )/)
    .map((block) => block.trim())
    .filter(Boolean)
}

function extractTopicFromBlock(block) {
  const topicMatch = block.match(/^\s*topic:\s+(.*)$/m)
  return topicMatch ? topicMatch[1].trim() : null
}

/**
 * ¿El topic pertenece a este workspace? Exportada para probarla sola.
 *
 * Los tres topics canónicos tenían su rama con `===`, subsumida por el primer
 * `startsWith`: ramas muertas con seis mutantes equivalentes. Ver el test.
 */
export function isWorkspaceScopedTopic(topic, workspace) {
  return topic.startsWith(`${workspace}-`)
    || topic.startsWith(`sdd-${workspace}-`)
    || topic.startsWith(`sandbox-${workspace}-`)
}

async function runIcmCommand(args, options = {}) {
  const { allowFailure = false } = options

  try {
    const { stdout, stderr } = await execFileAsync('icm', args, {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024,
    })

    return {
      ok: true,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('icm CLI is required to export memory bundles.')
    }

    if (allowFailure) {
      return {
        ok: false,
        stdout: `${error.stdout ?? ''}`.trim(),
        stderr: `${error.stderr ?? error.message ?? ''}`.trim(),
      }
    }

    const errorDetails = `${error.stderr ?? error.message ?? 'Unknown icm error.'}`.trim()
    throw new Error(`icm ${args.join(' ')} failed: ${errorDetails}`)
  }
}

async function loadMemoriesScopePayload({ workspace }) {
  const result = await runIcmCommand(['list', '--all', '--no-embeddings'])
  const blocks = splitCliBlocks(result.stdout)
  const matchedBlocks = blocks.filter((block) => isWorkspaceScopedTopic(extractTopicFromBlock(block) ?? '', workspace))

  return {
    format: 'icm-list-text',
    matchedEntryCount: matchedBlocks.length,
    topics: matchedBlocks
      .map((block) => extractTopicFromBlock(block))
      .filter(Boolean),
    raw: matchedBlocks.join('\n\n'),
  }
}

async function loadMemoirScopePayload({ workspace, memoirNames = defaultMemoirNames }) {
  const exportedMemoirs = []

  for (const memoirSuffix of memoirNames) {
    const memoirName = `${workspace}-${memoirSuffix}`
    const result = await runIcmCommand(['memoir', 'export', '--memoir', memoirName], { allowFailure: true })

    if (!result.ok || !result.stdout) {
      continue
    }

    exportedMemoirs.push(JSON.parse(result.stdout))
  }

  return {
    format: 'icm-memoir-json',
    memoirCount: exportedMemoirs.length,
    memoirs: exportedMemoirs,
  }
}

async function loadFeedbackScopePayload({ workspace }) {
  const result = await runIcmCommand(['feedback', 'search', workspace, '--no-embeddings', '--limit', '100'], { allowFailure: true })

  return {
    format: 'icm-feedback-search-text',
    query: workspace,
    raw: result.stdout,
  }
}

async function defaultScopePayloadLoader({ scope, workspace, versionId, manifest, versionsRoot }) {
  if (scope === 'memories') {
    return loadMemoriesScopePayload({ workspace, versionId, manifest, versionsRoot })
  }

  if (scope === 'memoir') {
    return loadMemoirScopePayload({ workspace, versionId, manifest, versionsRoot })
  }

  if (scope === 'feedback') {
    return loadFeedbackScopePayload({ workspace, versionId, manifest, versionsRoot })
  }

  throw new Error(`Unsupported export scope "${scope}".`)
}

// Se exporta el selector y no los tres loaders: el punto de extensión que
// `exportMemoryBundle` acepta es el selector entero, y exponer los loaders
// sueltos invitaría a llamarlos sin pasar por la validación de scope.
export { defaultScopePayloadLoader }
